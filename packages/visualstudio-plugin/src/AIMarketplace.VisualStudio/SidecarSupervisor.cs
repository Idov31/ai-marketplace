using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace AIMarketplace.VisualStudio;

internal sealed class SidecarSupervisor : IDisposable
{
    private readonly MarketplaceOptions options;
    private readonly WorkspaceRootService roots;
    private readonly CredentialBroker credentials;
    private readonly Action<string> log;
    private readonly SemaphoreSlim lifecycle = new(1, 1);
    private Process? process;
    private ProtocolClient? protocol;
    private Uri? origin;
    private IntPtr jobHandle;
    private readonly HashSet<string> negotiatedCapabilities = new(StringComparer.Ordinal);

    internal SidecarSupervisor(MarketplaceOptions options, WorkspaceRootService roots, CredentialBroker credentials, Action<string> log)
    {
        this.options = options; this.roots = roots; this.credentials = credentials; this.log = log;
    }

    internal async Task<Uri> StartAsync(CancellationToken cancellationToken = default)
    {
        await lifecycle.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (process is { HasExited: false } && origin is not null) return origin;
            DisposeProcess();
            var extensionRoot = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? throw new InvalidOperationException("Unable to locate the extension directory.");
            var manifest = RuntimeManifest.Load(extensionRoot);
            manifest.VerifyDistribution();
            var architecture = Environment.Is64BitProcess && System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture == System.Runtime.InteropServices.Architecture.Arm64 ? "win-arm64" : "win-x64";
            var node = manifest.Verify($"Runtime/{architecture}/node.exe");
            var sidecar = manifest.Verify("Sidecar/ai-marketplace.cjs");
            var start = new ProcessStartInfo(node, $"\"{sidecar}\" __host-sidecar")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                WorkingDirectory = extensionRoot
            };
            SanitizeEnvironment(start);
            process = Process.Start(start) ?? throw new InvalidOperationException("Unable to start the AI Marketplace sidecar.");
            jobHandle = CreateKillOnCloseJob(process);
            _ = PumpDiagnosticsAsync(process.StandardError, process);
            protocol = new ProtocolClient(process.StandardOutput.BaseStream, process.StandardInput.BaseStream, HandleCallbackAsync, log);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            var workspaceRoot = await roots.GetWorkspaceRootAsync().ConfigureAwait(false);
            var initialize = new JObject
            {
                ["protocolVersion"] = ProtocolClient.ProtocolVersion,
                ["runtimeVersion"] = "1.1.0",
                ["host"] = "visualstudio",
                ["hostVersion"] = typeof(Microsoft.VisualStudio.Shell.AsyncPackage).Assembly.GetName().Version?.ToString() ?? "17",
                ["extensionVersion"] = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.1.0",
                ["userRoot"] = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ["platform"] = options.PlatformId,
                ["capabilities"] = new JArray("credentials", "configuration", "notifications", "external-links")
            };
            negotiatedCapabilities.Clear();
            foreach (var capability in initialize["capabilities"] as JArray ?? new JArray()) negotiatedCapabilities.Add(capability.Value<string>() ?? string.Empty);
            if (workspaceRoot is not null) initialize["workspaceRoot"] = workspaceRoot;
            var response = await protocol.RequestAsync("initialize", initialize, timeout.Token).ConfigureAwait(false);
            if (response.Value<int?>("protocolVersion") != ProtocolClient.ProtocolVersion
                || response.Value<string>("runtimeVersion") != "1.1.0"
                || response.Value<string>("platform") != options.PlatformId)
                throw new InvalidDataException("Sidecar handshake response is incompatible with this extension.");
            var url = response.Value<string>("launchUrl") ?? throw new InvalidDataException("Sidecar did not return a launch URL.");
            var parsed = new Uri(url);
            if (parsed.Scheme != Uri.UriSchemeHttp || parsed.Host != "127.0.0.1" || string.IsNullOrEmpty(parsed.Fragment)) throw new InvalidDataException("Sidecar returned an unsafe launch URL.");
            origin = new Uri(parsed.GetLeftPart(UriPartial.Authority));
            log($"Sidecar started for {options.PlatformId} at {origin}.");
            return parsed;
        }
        catch { DisposeProcess(); throw; }
        finally { lifecycle.Release(); }
    }

    internal async Task<JToken> RequestAsync(string method, CancellationToken cancellationToken = default)
    {
        await StartAsync(cancellationToken).ConfigureAwait(false);
        return await protocol!.RequestAsync(method, new JObject(), cancellationToken).ConfigureAwait(false);
    }

    internal async Task StopAsync()
    {
        await lifecycle.WaitAsync().ConfigureAwait(false);
        try
        {
            if (protocol is not null && process is { HasExited: false })
            {
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                try { await protocol.RequestAsync("shutdown", new JObject(), timeout.Token).ConfigureAwait(false); } catch (Exception error) { log("Graceful sidecar shutdown failed: " + error.Message); }
            }
            DisposeProcess();
        }
        finally { lifecycle.Release(); }
    }

    private Task<JToken> HandleCallbackAsync(string method, JToken parameters, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (method == "configuration.get") return Task.FromResult<JToken>(new JObject { ["config"] = options.GetConfiguration() });
        if (method == "configuration.set")
        {
            options.SetConfiguration(parameters["config"] ?? throw new InvalidDataException("Configuration callback is missing config."));
            return Task.FromResult<JToken>(new JObject { ["saved"] = true });
        }
        if (method == "credentials.get")
        {
            if (!negotiatedCapabilities.Contains("credentials")) throw new InvalidOperationException("Credential capability was not negotiated.");
            var provider = parameters.Value<string>("provider") ?? throw new InvalidDataException("Credential callback provider is missing.");
            var sourceId = parameters.Value<string>("sourceId");
            ValidateCredentialRequest(options.GetConfiguration(), provider, sourceId);
            return Task.FromResult<JToken>(credentials.Get(provider, sourceId));
        }
        throw new InvalidOperationException($"Sidecar callback method '{method}' is not allowed.");
    }

    internal static void ValidateCredentialRequest(JObject configuration, string provider, string? sourceId)
    {
        if (provider is not ("github" or "azure-devops" or "gitlab")) throw new InvalidDataException("Credential callback provider is unsupported.");
        if (sourceId is null) return;
        var repositories = configuration["repositories"] as JArray ?? new JArray();
        var source = repositories.OfType<JObject>().FirstOrDefault(item => item.Value<string>("id") == sourceId)
            ?? throw new InvalidDataException("Credential callback source is not configured.");
        var configuredProvider = source.Value<string>("provider") ?? InferProvider(source.Value<string>("url") ?? string.Empty);
        if (configuredProvider != provider) throw new InvalidDataException("Credential callback provider does not match its configured source.");
    }

    private static string InferProvider(string url)
    {
        if (url.IndexOf("dev.azure.com", StringComparison.OrdinalIgnoreCase) >= 0 || url.IndexOf("visualstudio.com", StringComparison.OrdinalIgnoreCase) >= 0) return "azure-devops";
        if (url.IndexOf("gitlab", StringComparison.OrdinalIgnoreCase) >= 0) return "gitlab";
        return "github";
    }

    private async Task PumpDiagnosticsAsync(StreamReader reader, Process owner)
    {
        while (!owner.HasExited)
        {
            var line = await reader.ReadLineAsync().ConfigureAwait(false);
            if (line is null) break;
            log(line);
        }
    }

    private static void SanitizeEnvironment(ProcessStartInfo start)
    {
        var allowed = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["SystemRoot"] = Environment.GetEnvironmentVariable("SystemRoot"),
            ["ComSpec"] = Environment.GetEnvironmentVariable("ComSpec"),
            ["TEMP"] = Environment.GetEnvironmentVariable("TEMP"),
            ["TMP"] = Environment.GetEnvironmentVariable("TMP"),
            ["PATH"] = Environment.GetEnvironmentVariable("SystemRoot") + "\\System32"
        };
        start.EnvironmentVariables.Clear();
        foreach (var pair in allowed) if (!string.IsNullOrWhiteSpace(pair.Value)) start.EnvironmentVariables[pair.Key] = pair.Value;
        start.EnvironmentVariables["AI_MARKETPLACE_NATIVE_HOST"] = "visualstudio";
    }

    private void DisposeProcess()
    {
        origin = null; protocol?.Dispose(); protocol = null;
        negotiatedCapabilities.Clear();
        if (jobHandle != IntPtr.Zero) { CloseHandle(jobHandle); jobHandle = IntPtr.Zero; }
        if (process is not null)
        {
            if (!process.HasExited) try { process.Kill(); } catch { }
            process.Dispose(); process = null;
        }
    }

    public void Dispose() { DisposeProcess(); lifecycle.Dispose(); }

    private static IntPtr CreateKillOnCloseJob(Process owner)
    {
        var job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "Unable to create the sidecar job object.");
        var information = new JobObjectExtendedLimitInformation { BasicLimitInformation = new JobObjectBasicLimitInformation { LimitFlags = 0x00002000 } };
        if (!SetInformationJobObject(job, 9, ref information, (uint)Marshal.SizeOf(information)) || !AssignProcessToJobObject(job, owner.Handle))
        {
            var error = Marshal.GetLastWin32Error(); CloseHandle(job);
            throw new Win32Exception(error, "Unable to bind the sidecar process tree to Visual Studio.");
        }
        return job;
    }

    [StructLayout(LayoutKind.Sequential)] private struct JobObjectBasicLimitInformation { public long PerProcessUserTimeLimit; public long PerJobUserTimeLimit; public uint LimitFlags; public UIntPtr MinimumWorkingSetSize; public UIntPtr MaximumWorkingSetSize; public uint ActiveProcessLimit; public IntPtr Affinity; public uint PriorityClass; public uint SchedulingClass; }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOperationCount; public ulong WriteOperationCount; public ulong OtherOperationCount; public ulong ReadTransferCount; public ulong WriteTransferCount; public ulong OtherTransferCount; }
    [StructLayout(LayoutKind.Sequential)] private struct JobObjectExtendedLimitInformation { public JobObjectBasicLimitInformation BasicLimitInformation; public IoCounters IoInfo; public UIntPtr ProcessMemoryLimit; public UIntPtr JobMemoryLimit; public UIntPtr PeakProcessMemoryUsed; public UIntPtr PeakJobMemoryUsed; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateJobObject(IntPtr securityAttributes, string? name);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetInformationJobObject(IntPtr job, int informationClass, ref JobObjectExtendedLimitInformation information, uint length);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool CloseHandle(IntPtr handle);
}

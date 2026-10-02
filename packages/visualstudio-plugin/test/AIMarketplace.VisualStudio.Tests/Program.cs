using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using AIMarketplace.VisualStudio;

internal static class Program
{
    private static async System.Threading.Tasks.Task<int> Main()
    {
        var failed = 0;
        failed += await RunAsync("protocol reads a valid frame", ProtocolReadsFrameAsync);
        failed += await RunAsync("protocol rejects an oversized frame", ProtocolRejectsOversizedFrameAsync);
        Run("runtime manifest verifies hashes", RuntimeManifestVerifiesHash, ref failed);
        Run("runtime manifest rejects traversal", RuntimeManifestRejectsTraversal, ref failed);
        Run("runtime manifest rejects extra files", RuntimeManifestRejectsExtraFiles, ref failed);
        Run("credential callbacks require configured provider binding", CredentialCallbacksRequireBinding, ref failed);
        Run("credential methods and targets match configured repository providers", CredentialMethodsAndTargets, ref failed);
        Run("tool window unload preserves the browser until final disposal", ToolWindowUnloadPreservesBrowser, ref failed);
        Run("reattachment and reload replace the previous browser", ToolWindowReattachmentReplacesBrowser, ref failed);
        Run("reattachment cancels pending initialization before replacing the browser", ToolWindowReattachmentCancelsInitialization, ref failed);
        Run("sidecar launch URLs require a token and the negotiated origin", LaunchUrlsRequireAuthentication, ref failed);
        var total = 11;
        if (Environment.GetEnvironmentVariable("AI_MARKETPLACE_VISUALSTUDIO_UI_SMOKE") == "1")
        {
            total++;
            Run("live browser renders after reparenting and reload", () => RunWpfTest(DockingSmoke.RunAsync), ref failed);
        }
        Console.WriteLine($"Visual Studio native tests: {total - failed} passed, {failed} failed.");
        return failed == 0 ? 0 : 1;
    }

    private static async System.Threading.Tasks.Task ProtocolReadsFrameAsync()
    {
        var body = "{\"protocolVersion\":1,\"type\":\"response\",\"id\":\"host-1\",\"result\":{}}";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes($"Content-Length: {Encoding.UTF8.GetByteCount(body)}\r\n\r\n{body}"));
        var value = await ProtocolClient.ReadFrameAsync(stream, CancellationToken.None);
        Assert(value.Value<string>("id") == "host-1", "frame id was not preserved");
    }

    private static async System.Threading.Tasks.Task ProtocolRejectsOversizedFrameAsync()
    {
        using var stream = new MemoryStream(Encoding.ASCII.GetBytes($"Content-Length: {ProtocolClient.MaximumFrameBytes + 1}\r\n\r\n"));
        try { await ProtocolClient.ReadFrameAsync(stream, CancellationToken.None); }
        catch (InvalidDataException) { return; }
        throw new InvalidOperationException("Expected InvalidDataException.");
    }

    private static void RuntimeManifestVerifiesHash()
    {
        using var fixture = new RuntimeFixture("Sidecar/ai-marketplace.cjs", "trusted");
        Assert(File.ReadAllText(fixture.Manifest.Verify("Sidecar/ai-marketplace.cjs")) == "trusted", "verified path was incorrect");
        File.WriteAllText(Path.Combine(fixture.Root, "Sidecar", "ai-marketplace.cjs"), "changed");
        AssertThrows<InvalidDataException>(() => fixture.Manifest.Verify("Sidecar/ai-marketplace.cjs"));
    }

    private static void RuntimeManifestRejectsTraversal()
    {
        using var fixture = new RuntimeFixture("safe/file.txt", "trusted");
        AssertThrows<InvalidDataException>(() => fixture.Manifest.Verify("../outside.txt"));
    }

    private static void RuntimeManifestRejectsExtraFiles()
    {
        using var fixture = new RuntimeFixture("safe/file.txt", "trusted");
        var path = Path.Combine(fixture.Root, "runtime-manifest.json");
        var json = File.ReadAllText(path).Replace("]}", ",{\"path\":\"extra.js\",\"sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}]}");
        File.WriteAllText(path, json);
        AssertThrows<InvalidDataException>(() => RuntimeManifest.Load(fixture.Root));
    }

    private static void CredentialCallbacksRequireBinding()
    {
        var config = Newtonsoft.Json.Linq.JObject.Parse("{\"schemaVersion\":1,\"repositories\":[{\"id\":\"team\",\"provider\":\"gitlab\",\"url\":\"https://gitlab.example.com/team/packages\"}]}");
        SidecarSupervisor.ValidateCredentialRequest(config, "gitlab", "team");
        AssertThrows<InvalidDataException>(() => SidecarSupervisor.ValidateCredentialRequest(config, "github", "team"));
        AssertThrows<InvalidDataException>(() => SidecarSupervisor.ValidateCredentialRequest(config, "gitlab", "unknown"));
        AssertThrows<InvalidDataException>(() => SidecarSupervisor.ValidateCredentialRequest(config, "arbitrary", null));
    }

    private static void LaunchUrlsRequireAuthentication()
    {
        var origin = new Uri("http://127.0.0.1:57487/");
        Assert(SidecarSupervisor.ValidateLaunchUrl("http://127.0.0.1:57487/#token=fresh", origin).Fragment == "#token=fresh", "launch token was lost");
        AssertThrows<InvalidDataException>(() => SidecarSupervisor.ValidateLaunchUrl("http://127.0.0.1:57487/", origin));
        AssertThrows<InvalidDataException>(() => SidecarSupervisor.ValidateLaunchUrl("http://127.0.0.1:57488/#token=fresh", origin));
        AssertThrows<InvalidDataException>(() => SidecarSupervisor.ValidateLaunchUrl("https://example.com/#token=fresh", origin));
        AssertThrows<InvalidDataException>(() => SidecarSupervisor.ValidateLaunchUrl("http://127.0.0.1:57487/#token=", origin));
    }

    private static void CredentialMethodsAndTargets()
    {
        Assert(CredentialDialog.MethodsFor("github")[0].Kind == "bearer", "GitHub PAT must use bearer authentication");
        Assert(CredentialDialog.MethodsFor("azure-devops")[0].Kind == "basic-pat", "Azure DevOps PAT must use basic authentication");
        Assert(CredentialDialog.MethodsFor("azure-devops")[1].Kind == "bearer", "Entra/OAuth must use bearer authentication");
        Assert(CredentialDialog.MethodsFor("gitlab")[0].Kind == "private-token", "GitLab access tokens must use the private-token method");
        Assert(CredentialDialog.MethodsFor("gitlab")[1].Kind == "bearer", "GitLab OAuth must use bearer authentication");
        AssertThrows<ArgumentException>(() => CredentialDialog.MethodsFor("unknown"));
        var config = Newtonsoft.Json.Linq.JObject.Parse("{\"schemaVersion\":1,\"repositories\":[{\"id\":\"team\",\"provider\":\"gitlab\",\"url\":\"https://gitlab.example.com/team/packages\"},{\"id\":\"github-team\",\"url\":\"https://github.com/example/packages\"}]}");
        var targets = CredentialDialog.TargetsFor(config);
        Assert(targets.Length == 5, "shared provider choices and configured repositories must be discoverable");
        Assert(targets[0].SourceId is null && targets[1].SourceId is null && targets[2].SourceId is null, "shared credentials must not invent source ids");
        Assert(targets[3].Provider == "gitlab" && targets[3].SourceId == "team", "repository credential target was not preserved");
        Assert(targets[4].Provider == "github", "URL-inferred provider was lost");
        SidecarSupervisor.ValidateCredentialRequest(config, targets[3].Provider, targets[3].SourceId);
    }

    private static void ToolWindowReattachmentReplacesBrowser() => RunWpfTest(async () =>
    {
        var launches = 0;
        using var control = new MarketplaceToolWindowControl(_ =>
        {
            launches++;
            return System.Threading.Tasks.Task.FromException<Uri>(new InvalidOperationException("Simulated unavailable sidecar."));
        }, configureCredentials: () => false, logFailure: _ => { });
        var first = (Microsoft.Web.WebView2.Wpf.WebView2)control.Children[1];
        control.RaiseEvent(new System.Windows.RoutedEventArgs(System.Windows.FrameworkElement.LoadedEvent));
        Assert(launches == 1, "initial attachment did not launch the dashboard");
        control.RaiseEvent(new System.Windows.RoutedEventArgs(System.Windows.FrameworkElement.UnloadedEvent));
        control.RaiseEvent(new System.Windows.RoutedEventArgs(System.Windows.FrameworkElement.LoadedEvent));
        var second = (Microsoft.Web.WebView2.Wpf.WebView2)control.Children[1];
        Assert(!ReferenceEquals(first, second) && launches == 2, "reattachment reused the stale parent-bound controller");
        AssertThrows<ObjectDisposedException>(() => { _ = first.EnsureCoreWebView2Async(); });
        await control.ReloadAsync();
        Assert(!ReferenceEquals(second, control.Children[1]) && launches == 3, "reload did not replace and retry the browser");
        var toolbar = (System.Windows.Controls.Panel)control.Children[2];
        Assert(toolbar.Children.Count == 2, "authentication and recovery controls must remain outside the browser");
    });

    private static void ToolWindowReattachmentCancelsInitialization() => RunWpfTest(async () =>
    {
        var launches = 0;
        using var control = new MarketplaceToolWindowControl(token =>
        {
            launches++;
            if (launches > 1) return System.Threading.Tasks.Task.FromException<Uri>(new InvalidOperationException("Simulated unavailable sidecar."));
            var pending = new System.Threading.Tasks.TaskCompletionSource<Uri>();
            token.Register(() => pending.TrySetCanceled());
            return pending.Task;
        }, configureCredentials: () => false, logFailure: _ => { });
        var first = control.Children[1];
        control.RaiseEvent(new System.Windows.RoutedEventArgs(System.Windows.FrameworkElement.LoadedEvent));
        control.RaiseEvent(new System.Windows.RoutedEventArgs(System.Windows.FrameworkElement.UnloadedEvent));
        control.RaiseEvent(new System.Windows.RoutedEventArgs(System.Windows.FrameworkElement.LoadedEvent));
        await System.Threading.Tasks.Task.Yield();
        Assert(launches == 2 && !ReferenceEquals(first, control.Children[1]), "canceled initialization prevented reattachment recovery");
    });

    private static void RunWpfTest(Func<System.Threading.Tasks.Task> action)
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            var dispatcher = System.Windows.Threading.Dispatcher.CurrentDispatcher;
#pragma warning disable VSTHRD001 // The standalone harness owns this STA dispatcher rather than a Visual Studio JTF.
#pragma warning disable VSTHRD101 // Dispatcher Action requires void; this harness catches all asynchronous failures.
            _ = dispatcher.BeginInvoke(new Action(async () =>
            {
                try { await action(); }
                catch (Exception error) { failure = error; }
                finally { dispatcher.InvokeShutdown(); }
            }));
#pragma warning restore VSTHRD001
#pragma warning restore VSTHRD101
            System.Windows.Threading.Dispatcher.Run();
        }) { IsBackground = true };
        thread.SetApartmentState(ApartmentState.STA); thread.Start();
        if (!thread.Join(TimeSpan.FromSeconds(30))) throw new TimeoutException("WPF lifecycle test did not finish.");
        if (failure is not null) throw new InvalidOperationException("WPF lifecycle test failed.", failure);
    }

    private static void ToolWindowUnloadPreservesBrowser()
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            var dispatcher = System.Windows.Threading.Dispatcher.CurrentDispatcher;
#pragma warning disable VSTHRD001 // This standalone WPF harness owns its STA dispatcher, not a Visual Studio JTF.
            _ = dispatcher.BeginInvoke(new Action(() =>
            {
            try
            {
                var control = new MarketplaceToolWindowControl();
                var browser = (Microsoft.Web.WebView2.Wpf.WebView2)control.Children[1];
                control.RaiseEvent(new System.Windows.RoutedEventArgs(System.Windows.FrameworkElement.UnloadedEvent));
                var initialization = browser.EnsureCoreWebView2Async();
                if (initialization.IsFaulted) throw initialization.Exception!;
                control.Dispose();
                control.Dispose();
                AssertThrows<ObjectDisposedException>(() => { _ = browser.EnsureCoreWebView2Async(); });
            }
            catch (Exception error) { failure = error; }
            finally { dispatcher.InvokeShutdown(); }
            }));
#pragma warning restore VSTHRD001
            System.Windows.Threading.Dispatcher.Run();
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        if (!thread.Join(TimeSpan.FromSeconds(30))) throw new TimeoutException("WPF browser lifecycle regression test did not finish.");
        if (failure is not null) throw new InvalidOperationException("WPF browser lifecycle regression test failed.", failure);
    }

    private static void Run(string name, Action test, ref int failed)
    {
        try { test(); Console.WriteLine("PASS " + name); }
#pragma warning disable VSTHRD103 // This synchronous console executable is the test harness itself.
        catch (Exception error) { failed++; Console.Error.WriteLine("FAIL " + name + ": " + error); }
#pragma warning restore VSTHRD103
    }

    private static async System.Threading.Tasks.Task<int> RunAsync(string name, Func<System.Threading.Tasks.Task> test)
    {
        try { await test(); Console.WriteLine("PASS " + name); return 0; }
#pragma warning disable VSTHRD103 // This synchronous console executable is the test harness itself.
        catch (Exception error) { Console.Error.WriteLine("FAIL " + name + ": " + error); return 1; }
#pragma warning restore VSTHRD103
    }

    private static void Assert(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
    private static void AssertThrows<T>(Action action) where T : Exception { try { action(); } catch (T) { return; } throw new InvalidOperationException($"Expected {typeof(T).Name}."); }

    private sealed class RuntimeFixture : IDisposable
    {
        internal string Root { get; }
        internal RuntimeManifest Manifest { get; }
        internal RuntimeFixture(string relative, string content)
        {
            Root = Path.Combine(Path.GetTempPath(), "ai-marketplace-vs-test-" + Guid.NewGuid().ToString("N"));
            var required = new[] { "Runtime/win-x64/node.exe", "Runtime/win-arm64/node.exe", "Sidecar/ai-marketplace.cjs", "Dashboard/index.html", "Dashboard/app.js", "Dashboard/styles.css", "Assets/ai-marketplace.png" };
            var entries = new System.Collections.Generic.List<string>();
            foreach (var item in required)
            {
                var file = Path.Combine(Root, item.Replace('/', Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(file)); File.WriteAllText(file, item == relative ? content : "trusted");
                using var sha = SHA256.Create();
                var hash = BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(file))).Replace("-", string.Empty).ToLowerInvariant();
                entries.Add($"{{\"path\":\"{item}\",\"sha256\":\"{hash}\"}}");
            }
            File.WriteAllText(Path.Combine(Root, "runtime-manifest.json"), $"{{\"schemaVersion\":1,\"files\":[{string.Join(",", entries)}]}}");
            Manifest = RuntimeManifest.Load(Root);
        }
        public void Dispose() { Directory.Delete(Root, true); }
    }
}

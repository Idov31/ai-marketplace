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
        Console.WriteLine($"Visual Studio native tests: {6 - failed} passed, {failed} failed.");
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
            var required = new[] { "Runtime/win-x64/node.exe", "Runtime/win-arm64/node.exe", "Sidecar/ai-marketplace.cjs", "Dashboard/index.html", "Dashboard/app.js", "Dashboard/styles.css" };
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

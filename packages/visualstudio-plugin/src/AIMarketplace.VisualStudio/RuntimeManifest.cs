using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Newtonsoft.Json.Linq;

namespace AIMarketplace.VisualStudio;

internal sealed class RuntimeManifest
{
    private static readonly string[] RequiredFiles =
    {
        "Runtime/win-x64/node.exe",
        "Runtime/win-arm64/node.exe",
        "Sidecar/ai-marketplace.cjs",
        "Dashboard/index.html",
        "Dashboard/app.js",
        "Dashboard/styles.css"
    };
    private readonly string root;
    private readonly IReadOnlyDictionary<string, string> hashes;

    private RuntimeManifest(string root, IReadOnlyDictionary<string, string> hashes)
    {
        this.root = root;
        this.hashes = hashes;
    }

    internal static RuntimeManifest Load(string extensionRoot)
    {
        var path = Path.Combine(extensionRoot, "runtime-manifest.json");
        var json = JObject.Parse(File.ReadAllText(path));
        if (json.Value<int?>("schemaVersion") != 1) throw new InvalidDataException("Runtime manifest version is unsupported.");
        var entries = json["files"] as JArray ?? throw new InvalidDataException("Runtime manifest files are missing.");
        var hashes = entries.OfType<JObject>().ToDictionary(
            entry => Normalize(entry.Value<string>("path") ?? throw new InvalidDataException("Runtime path is missing.")),
            entry => (entry.Value<string>("sha256") ?? throw new InvalidDataException("Runtime hash is missing.")).ToLowerInvariant(),
            StringComparer.OrdinalIgnoreCase);
        if (hashes.Count != RequiredFiles.Length || RequiredFiles.Any(path => !hashes.ContainsKey(path))) throw new InvalidDataException("Runtime manifest does not contain the exact required distribution files.");
        return new RuntimeManifest(extensionRoot, hashes);
    }

    internal void VerifyDistribution() { foreach (var path in RequiredFiles) Verify(path); }

    internal string Verify(string relativePath)
    {
        var normalized = Normalize(relativePath);
        if (!hashes.TryGetValue(normalized, out var expected) || expected.Length != 64) throw new InvalidDataException($"Runtime file '{normalized}' is not declared.");
        var fullPath = Path.GetFullPath(Path.Combine(root, normalized.Replace('/', Path.DirectorySeparatorChar)));
        var rootWithSeparator = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!fullPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Runtime path escapes the signed distribution.");
        RejectReparsePoints(fullPath, rootWithSeparator.TrimEnd(Path.DirectorySeparatorChar));
        using var stream = File.OpenRead(fullPath);
        using var sha = SHA256.Create();
        var actual = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", string.Empty).ToLowerInvariant();
        if (!CryptographicEquals(actual, expected)) throw new InvalidDataException($"Runtime file '{normalized}' failed integrity verification.");
        return fullPath;
    }

    private static void RejectReparsePoints(string fullPath, string rootPath)
    {
        for (var current = fullPath; !string.Equals(current, rootPath, StringComparison.OrdinalIgnoreCase); current = Path.GetDirectoryName(current) ?? rootPath)
        {
            if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw new InvalidDataException("Runtime path contains an unsafe reparse point.");
        }
    }

    private static bool CryptographicEquals(string left, string right)
    {
        var leftBytes = System.Text.Encoding.ASCII.GetBytes(left); var rightBytes = System.Text.Encoding.ASCII.GetBytes(right);
        if (leftBytes.Length != rightBytes.Length) return false;
        var difference = 0;
        for (var index = 0; index < leftBytes.Length; index++) difference |= leftBytes[index] ^ rightBytes[index];
        return difference == 0;
    }

    private static string Normalize(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || Path.IsPathRooted(path)) throw new InvalidDataException("Runtime path must be relative.");
        var normalized = path.Replace('\\', '/');
        if (normalized.Split('/').Any(part => part is "" or "." or "..")) throw new InvalidDataException("Runtime path contains an unsafe segment.");
        return normalized;
    }
}

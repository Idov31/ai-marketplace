using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Newtonsoft.Json.Linq;

namespace AIMarketplace.VisualStudio;

internal sealed class CredentialBroker
{
    private const string Prefix = "AI Marketplace/VisualStudio/";

    internal JArray Get(string provider, string? sourceId)
    {
        ValidateId(provider, nameof(provider));
        if (sourceId is not null) ValidateId(sourceId, nameof(sourceId));
        var stored = Read(Target(provider, sourceId));
        if (stored is null) return new JArray();
        var parsed = JObject.Parse(stored);
        var kind = parsed.Value<string>("kind"); var token = parsed.Value<string>("token");
        if (kind is not ("bearer" or "basic-pat" or "private-token") || string.IsNullOrEmpty(token)) return new JArray();
        return new JArray(new JObject { ["kind"] = kind, ["token"] = token });
    }

    internal void Save(string provider, string? sourceId, string kind, string token)
    {
        ValidateId(provider, nameof(provider));
        if (sourceId is not null) ValidateId(sourceId, nameof(sourceId));
        if (kind is not ("bearer" or "basic-pat" or "private-token")) throw new ArgumentException("Credential kind is unsupported.", nameof(kind));
        if (string.IsNullOrWhiteSpace(token) || token.Length < 4 || token.Length > 16_384) throw new ArgumentException("Credential token must contain between 4 and 16,384 characters.", nameof(token));
        Write(Target(provider, sourceId), new JObject { ["kind"] = kind, ["token"] = token }.ToString(Newtonsoft.Json.Formatting.None));
    }

    internal void Delete(string provider, string? sourceId)
    {
        ValidateId(provider, nameof(provider));
        if (sourceId is not null) ValidateId(sourceId, nameof(sourceId));
        CredDelete(Target(provider, sourceId), CredentialType.Generic, 0);
    }

    private static string Target(string provider, string? sourceId) => Prefix + provider + "/" + (sourceId ?? "shared");

    private static void ValidateId(string value, string name)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(value, "^[A-Za-z0-9._-]+$")) throw new ArgumentException("Credential identifier is invalid.", name);
    }

    private static string? Read(string target)
    {
        if (!CredRead(target, CredentialType.Generic, 0, out var pointer))
        {
            var error = Marshal.GetLastWin32Error();
            if (error == 1168) return null;
            throw new Win32Exception(error);
        }
        try
        {
            var credential = Marshal.PtrToStructure<NativeCredential>(pointer);
            if (credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0) return null;
            var bytes = new byte[credential.CredentialBlobSize];
            Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
            return Encoding.UTF8.GetString(bytes);
        }
        finally { CredFree(pointer); }
    }

    private static void Write(string target, string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var blob = Marshal.AllocCoTaskMem(bytes.Length);
        try
        {
            Marshal.Copy(bytes, 0, blob, bytes.Length);
            var credential = new NativeCredential { Type = CredentialType.Generic, TargetName = target, CredentialBlobSize = (uint)bytes.Length, CredentialBlob = blob, Persist = CredentialPersist.LocalMachine, UserName = Environment.UserName };
            if (!CredWrite(ref credential, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        finally { Marshal.FreeCoTaskMem(blob); }
    }

    private enum CredentialType : uint { Generic = 1 }
    private enum CredentialPersist : uint { LocalMachine = 2 }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct NativeCredential
    {
        public uint Flags;
        public CredentialType Type;
        public string TargetName;
        public string? Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public CredentialPersist Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string? TargetAlias;
        public string UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool CredRead(string target, CredentialType type, int reservedFlag, out IntPtr credentialPtr);
    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool CredWrite([In] ref NativeCredential userCredential, uint flags);
    [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool CredDelete(string target, CredentialType type, int flags);
    [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = false)] private static extern void CredFree(IntPtr credential);
}

using System;
using System.Collections.Concurrent;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace AIMarketplace.VisualStudio;

internal sealed class ProtocolClient : IDisposable
{
    internal const int ProtocolVersion = 1;
    internal const int MaximumFrameBytes = 64 * 1024;
    private readonly Stream input;
    private readonly Stream output;
    private readonly Func<string, JToken, CancellationToken, Task<JToken>> callback;
    private readonly Action<string> diagnostic;
    private readonly SemaphoreSlim writeLock = new(1, 1);
    private readonly ConcurrentDictionary<string, TaskCompletionSource<JToken>> pending = new();
    private readonly ConcurrentDictionary<string, byte> ignoredResponses = new();
    private readonly CancellationTokenSource lifetime = new();
    private int nextId;

    internal ProtocolClient(Stream input, Stream output, Func<string, JToken, CancellationToken, Task<JToken>> callback, Action<string> diagnostic)
    {
        this.input = input; this.output = output; this.callback = callback; this.diagnostic = diagnostic;
        _ = ReadLoopAsync(lifetime.Token);
    }

    internal async Task<JToken> RequestAsync(string method, JToken? parameters = null, CancellationToken cancellationToken = default)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(method, "^[a-z][a-z0-9.-]+$")) throw new ArgumentException("Protocol method is invalid.", nameof(method));
        var id = "host-" + Interlocked.Increment(ref nextId);
        var completion = new TaskCompletionSource<JToken>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!pending.TryAdd(id, completion)) throw new InvalidOperationException("Duplicate protocol request id.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lifetime.Token);
        timeout.CancelAfter(TimeSpan.FromSeconds(60));
        using var registration = timeout.Token.Register(() =>
        {
            if (pending.TryRemove(id, out var source))
            {
                RememberIgnoredResponse(id);
                source.TrySetCanceled(timeout.Token);
                _ = WriteAsync(new JObject { ["protocolVersion"] = ProtocolVersion, ["type"] = "notification", ["method"] = "cancel", ["params"] = new JObject { ["id"] = id } }, CancellationToken.None);
            }
        });
        await WriteAsync(new JObject { ["protocolVersion"] = ProtocolVersion, ["type"] = "request", ["id"] = id, ["method"] = method, ["params"] = parameters ?? new JObject() }, timeout.Token).ConfigureAwait(false);
        return await completion.Task.ConfigureAwait(false);
    }

    private async Task ReadLoopAsync(CancellationToken cancellationToken)
    {
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                var message = await ReadFrameAsync(input, cancellationToken).ConfigureAwait(false);
                ValidateEnvelope(message);
                var type = message.Value<string>("type");
                if (type == "response") CompleteResponse(message);
                else if (type == "request") _ = HandleCallbackAsync(message, cancellationToken);
                else throw new InvalidDataException("Runtime notification method is not allowed.");
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception error)
        {
            diagnostic("Sidecar protocol closed: " + error.Message);
            foreach (var item in pending) if (pending.TryRemove(item.Key, out var source)) source.TrySetException(error);
            lifetime.Cancel();
        }
    }

    private async Task HandleCallbackAsync(JObject message, CancellationToken cancellationToken)
    {
        var id = message.Value<string>("id") ?? throw new InvalidDataException("Runtime callback id is missing.");
        var method = message.Value<string>("method") ?? throw new InvalidDataException("Runtime callback method is missing.");
        try
        {
            var result = await callback(method, message["params"] ?? new JObject(), cancellationToken).ConfigureAwait(false);
            await WriteAsync(new JObject { ["protocolVersion"] = ProtocolVersion, ["type"] = "response", ["id"] = id, ["result"] = result }, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception error)
        {
            await WriteAsync(new JObject { ["protocolVersion"] = ProtocolVersion, ["type"] = "response", ["id"] = id, ["error"] = new JObject { ["code"] = "CALLBACK_FAILED", ["message"] = error.Message } }, cancellationToken).ConfigureAwait(false);
        }
    }

    private void CompleteResponse(JObject message)
    {
        var id = message.Value<string>("id") ?? throw new InvalidDataException("Runtime response id is missing.");
        if (!pending.TryRemove(id, out var completion))
        {
            if (ignoredResponses.TryRemove(id, out _)) return;
            throw new InvalidDataException("Runtime response id is unknown or duplicated.");
        }
        if (message["error"] is JObject error) completion.TrySetException(new InvalidOperationException($"{error.Value<string>("code")}: {error.Value<string>("message")}"));
        else if (message.TryGetValue("result", out var result)) completion.TrySetResult(result);
        else completion.TrySetException(new InvalidDataException("Runtime response has no result."));
    }

    private async Task WriteAsync(JObject message, CancellationToken cancellationToken)
    {
        var body = Encoding.UTF8.GetBytes(message.ToString(Formatting.None));
        if (body.Length is <= 0 or > MaximumFrameBytes) throw new InvalidDataException("Protocol output frame is too large.");
        var header = Encoding.ASCII.GetBytes($"Content-Length: {body.Length}\r\n\r\n");
        await writeLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await output.WriteAsync(header, 0, header.Length, cancellationToken).ConfigureAwait(false);
            await output.WriteAsync(body, 0, body.Length, cancellationToken).ConfigureAwait(false);
            await output.FlushAsync(cancellationToken).ConfigureAwait(false);
        }
        finally { writeLock.Release(); }
    }

    internal static async Task<JObject> ReadFrameAsync(Stream stream, CancellationToken cancellationToken)
    {
        var header = new MemoryStream(); var matched = 0;
        var boundary = new byte[] { 13, 10, 13, 10 };
        while (matched < boundary.Length)
        {
            var one = new byte[1];
            if (await stream.ReadAsync(one, 0, 1, cancellationToken).ConfigureAwait(false) == 0) throw new EndOfStreamException("Runtime protocol stream ended.");
            header.WriteByte(one[0]);
            matched = one[0] == boundary[matched] ? matched + 1 : one[0] == boundary[0] ? 1 : 0;
            if (header.Length > 256) throw new InvalidDataException("Runtime protocol header is too large.");
        }
        var text = Encoding.ASCII.GetString(header.ToArray(), 0, checked((int)header.Length - 4));
        var match = System.Text.RegularExpressions.Regex.Match(text, "^Content-Length: ([0-9]+)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (!match.Success || !int.TryParse(match.Groups[1].Value, out var length) || length <= 0 || length > MaximumFrameBytes) throw new InvalidDataException("Runtime protocol frame length is invalid.");
        var body = new byte[length]; var offset = 0;
        while (offset < length)
        {
            var read = await stream.ReadAsync(body, offset, length - offset, cancellationToken).ConfigureAwait(false);
            if (read == 0) throw new EndOfStreamException("Runtime protocol body ended early.");
            offset += read;
        }
        return JObject.Parse(Encoding.UTF8.GetString(body));
    }

    private static void ValidateEnvelope(JObject message)
    {
        if (message.Value<int?>("protocolVersion") != ProtocolVersion || message.Value<string>("type") is not ("request" or "response")) throw new InvalidDataException("Runtime protocol envelope is invalid.");
    }

    private void RememberIgnoredResponse(string id)
    {
        if (ignoredResponses.Count >= 64)
        {
            foreach (var key in ignoredResponses.Keys) { ignoredResponses.TryRemove(key, out _); break; }
        }
        ignoredResponses[id] = 0;
    }

    public void Dispose()
    {
        lifetime.Cancel(); lifetime.Dispose(); writeLock.Dispose();
        foreach (var item in pending) if (pending.TryRemove(item.Key, out var source)) source.TrySetCanceled();
    }
}

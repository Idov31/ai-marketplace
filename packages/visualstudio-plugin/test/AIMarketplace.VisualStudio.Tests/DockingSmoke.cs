using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using AIMarketplace.VisualStudio;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

internal static class DockingSmoke
{
    internal static async Task RunAsync()
    {
        // Opt-in live test: isolated browser profile, loopback fixture, off-screen
        // windows. No VS services, saved tokens, user configuration, or network APIs.
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var server = ServeAsync(listener);
        var launches = 0;
        Exception? startupFailure = null;
        using var control = new MarketplaceToolWindowControl(
            _ => Task.FromResult(new Uri($"http://127.0.0.1:{port}/#token=launch-{++launches}")),
            () => false, error => startupFailure = error,
            Path.Combine(Path.GetTempPath(), "ai-marketplace-docking-smoke-" + Guid.NewGuid().ToString("N")));
        var firstWindow = TestWindow(); var secondWindow = TestWindow();
        try
        {
            firstWindow.Content = control; firstWindow.Show();
            var first = await WaitForPageAsync(control, () => startupFailure);
            await AssertRenderedAsync(first);
            Console.WriteLine("PASS live initial browser surface renders text");
            firstWindow.Content = null;
            secondWindow.Content = control; secondWindow.Show();
            var second = await WaitForPageAsync(control, () => startupFailure);
            if (ReferenceEquals(first, second)) throw new InvalidOperationException("Docking reused the old browser instance.");
            await AssertRenderedAsync(second);
            Console.WriteLine("PASS live reparented browser surface renders text");
            secondWindow.Content = null;
            await Task.Delay(50);
            secondWindow.Content = control;
            var reopened = await WaitForPageAsync(control, () => startupFailure);
            if (ReferenceEquals(second, reopened)) throw new InvalidOperationException("Reopening reused the old browser instance.");
            await AssertRenderedAsync(reopened);
            Console.WriteLine("PASS live reopened browser surface renders text");
            await control.ReloadAsync();
            var reloaded = await WaitForPageAsync(control, () => startupFailure);
            if (ReferenceEquals(reopened, reloaded)) throw new InvalidOperationException("Reload reused the old browser instance.");
            await AssertRenderedAsync(reloaded);
            Console.WriteLine("PASS live reloaded browser surface renders text");
            if (launches < 4) throw new InvalidOperationException("Reattachment did not request fresh launch URLs.");
        }
        finally
        {
            control.Dispose(); firstWindow.Close(); secondWindow.Close();
            listener.Stop(); await server;
        }
    }

    private static Window TestWindow() => new()
    {
        Width = 500, Height = 350, Left = -10000, Top = -10000,
        ShowActivated = false, ShowInTaskbar = false, WindowStyle = WindowStyle.None
    };

    private static async Task<WebView2> WaitForPageAsync(MarketplaceToolWindowControl control, Func<Exception?> failure)
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (DateTime.UtcNow < deadline)
        {
            if (failure() is { } error) throw new InvalidOperationException("Live browser initialization failed.", error);
            var browser = (WebView2)control.Children[1];
            if (browser.CoreWebView2 is not null && await browser.CoreWebView2.ExecuteScriptAsync("document.body !== null && document.body.textContent.includes('Marketplace docking smoke')") == "true") return browser;
            await Task.Delay(50);
        }
        throw new TimeoutException("The reattached marketplace page did not become ready.");
    }

    private static async Task AssertRenderedAsync(WebView2 browser)
    {
        await Task.Delay(200);
        using var image = new MemoryStream();
        await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
        image.Position = 0;
        var frame = BitmapDecoder.Create(image, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad).Frames[0];
        var bitmap = new FormatConvertedBitmap(frame, PixelFormats.Bgra32, null, 0);
        var stride = bitmap.PixelWidth * 4;
        var pixels = new byte[stride * bitmap.PixelHeight];
        bitmap.CopyPixels(pixels, stride, 0);
        var darkPixels = 0;
        for (var index = 0; index < pixels.Length; index += 4)
            if (pixels[index] < 160 && pixels[index + 1] < 160 && pixels[index + 2] < 160) darkPixels++;
        if (darkPixels < 100) throw new InvalidOperationException("The browser captured a blank surface instead of the fixture's dark text.");
    }

    private static async Task ServeAsync(TcpListener listener)
    {
        try
        {
            while (true)
            {
                var client = await listener.AcceptTcpClientAsync();
                // Chromium preconnects without sending headers. Handle each socket
                // independently so an idle preconnect cannot block the real request.
                _ = ServeClientAsync(client);
            }
        }
        catch (ObjectDisposedException) { }
        catch (SocketException) { }
    }

    private static async Task ServeClientAsync(TcpClient client)
    {
        using (client)
        {
            try
            {
                using var stream = client.GetStream();
                using var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, true);
                for (var line = await reader.ReadLineAsync(); !string.IsNullOrEmpty(line); line = await reader.ReadLineAsync()) { }
                var body = Encoding.UTF8.GetBytes("<!doctype html><html><body style='background:white;color:black'><h1>Marketplace docking smoke</h1></body></html>");
                var headers = Encoding.ASCII.GetBytes($"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {body.Length}\r\nConnection: close\r\n\r\n");
                await stream.WriteAsync(headers, 0, headers.Length);
                await stream.WriteAsync(body, 0, body.Length);
            }
            catch (IOException) { }
            catch (SocketException) { }
            catch (ObjectDisposedException) { }
        }
    }
}

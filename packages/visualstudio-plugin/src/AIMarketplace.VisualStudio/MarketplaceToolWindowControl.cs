using System;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace AIMarketplace.VisualStudio;

internal sealed class MarketplaceToolWindowControl : Grid
{
    private readonly WebView2 browser = new();
    private readonly TextBlock status = new() { Text = "Starting AI Marketplace...", Margin = new Thickness(16), TextWrapping = TextWrapping.Wrap };

    internal MarketplaceToolWindowControl()
    {
        Children.Add(status); Children.Add(browser); browser.Visibility = Visibility.Collapsed;
        Loaded += OnLoaded;
        Unloaded += (_, _) => browser.Dispose();
    }

#pragma warning disable VSTHRD100 // WPF Loaded requires a void handler; InitializeAsync handles and reports every failure.
    private async void OnLoaded(object sender, RoutedEventArgs eventArgs) => await InitializeAsync();
#pragma warning restore VSTHRD100

    private async System.Threading.Tasks.Task InitializeAsync()
    {
        try
        {
            var package = MarketplacePackage.Instance ?? throw new InvalidOperationException("AI Marketplace package is not initialized.");
            var launchUrl = await package.Sidecar.StartAsync();
            var userData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AI Marketplace", "VisualStudio", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(null, userData);
            await browser.EnsureCoreWebView2Async(environment);
            browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
            browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            var allowedOrigin = new Uri(launchUrl.GetLeftPart(UriPartial.Authority));
            browser.CoreWebView2.NavigationStarting += (_, eventArgs) =>
            {
                if (!Uri.TryCreate(eventArgs.Uri, UriKind.Absolute, out var target) || target.GetLeftPart(UriPartial.Authority) != allowedOrigin.AbsoluteUri.TrimEnd('/')) eventArgs.Cancel = true;
            };
            browser.CoreWebView2.NewWindowRequested += (_, eventArgs) =>
            {
                eventArgs.Handled = true;
                if (Uri.TryCreate(eventArgs.Uri, UriKind.Absolute, out var target) && target.Scheme == Uri.UriSchemeHttps) package.OpenExternal(target);
            };
            browser.Source = launchUrl; status.Visibility = Visibility.Collapsed; browser.Visibility = Visibility.Visible;
        }
        catch (Exception error)
        {
            status.Text = "AI Marketplace could not start. " + error.Message + " Open Tools > AI Marketplace > Diagnose AI Marketplace for details.";
            browser.Visibility = Visibility.Collapsed; status.Visibility = Visibility.Visible;
            MarketplacePackage.Instance?.Log(error.ToString());
        }
    }
}

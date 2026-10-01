using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace AIMarketplace.VisualStudio;

internal sealed class MarketplaceToolWindowControl : Grid, IDisposable
{
    private WebView2 browser = new();
    private readonly TextBlock status = new() { Text = "Starting AI Marketplace...", Margin = new Thickness(16), TextWrapping = TextWrapping.Wrap };
    private readonly CancellationTokenSource lifetime = new();
    private readonly SemaphoreSlim initializationGate = new(1, 1);
    private readonly Func<CancellationToken, Task<Uri>> launchDashboard;
    private readonly Func<bool> configureCredentials;
    private readonly Action<Exception> logFailure;
    private readonly string webViewDataFolder;
    private CancellationTokenSource? initializationCancellation;
    private bool attached;
    private bool recreateBrowser;
    private bool initializing;
    private bool initialized;
    private bool disposed;

    internal MarketplaceToolWindowControl(Func<CancellationToken, Task<Uri>>? launchDashboard = null, Func<bool>? configureCredentials = null, Action<Exception>? logFailure = null, string? webViewDataFolder = null)
    {
        this.launchDashboard = launchDashboard ?? (token => (MarketplacePackage.Instance ?? throw new InvalidOperationException("AI Marketplace package is not initialized.")).Sidecar.StartAsync(token));
        this.configureCredentials = configureCredentials ?? ConfigureHostCredentials;
        this.logFailure = logFailure ?? LogHostFailure;
        this.webViewDataFolder = webViewDataFolder ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AI Marketplace", "VisualStudio", "WebView2");
        RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        SetRow(status, 1); SetRow(browser, 1);
        Children.Add(status); Children.Add(browser); browser.Visibility = Visibility.Collapsed;
        var toolbar = new WrapPanel { Margin = new Thickness(8) };
        var credentials = new Button { Content = "Set repository credential...", Padding = new Thickness(8, 4, 8, 4), Margin = new Thickness(0, 0, 8, 0) };
        var reload = new Button { Content = "Reload marketplace", Padding = new Thickness(8, 4, 8, 4) };
        credentials.Click += OnCredentials;
        reload.Click += OnReload;
        toolbar.Children.Add(credentials); toolbar.Children.Add(reload); Children.Add(toolbar);
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        PresentationSource.AddSourceChangedHandler(this, OnSourceChanged);
    }

    private static bool ConfigureHostCredentials()
    {
        Microsoft.VisualStudio.Shell.ThreadHelper.ThrowIfNotOnUIThread();
        return MarketplacePackage.Instance?.ManageCredentials() == true;
    }

    private static void LogHostFailure(Exception error) => MarketplacePackage.Instance?.Log(error.ToString());

#pragma warning disable VSTHRD100 // WPF Loaded requires a void handler; InitializeAsync handles and reports every failure.
    private async void OnLoaded(object sender, RoutedEventArgs eventArgs)
    {
        attached = true;
        await EnsureAttachedAsync();
    }

    private async void OnReload(object sender, RoutedEventArgs eventArgs) => await ReloadAsync();

    private async void OnSourceChanged(object sender, SourceChangedEventArgs eventArgs)
    {
        if (disposed || eventArgs.OldSource is null || ReferenceEquals(eventArgs.OldSource, eventArgs.NewSource)) return;
        recreateBrowser = true;
        initializationCancellation?.Cancel();
        if (eventArgs.NewSource is not null && attached) await EnsureAttachedAsync();
    }

    private async void OnCredentials(object sender, RoutedEventArgs eventArgs)
    {
        try
        {
            if (!configureCredentials()) return;
            if (MarketplacePackage.Instance is { } package) await package.Sidecar.RequestAsync("refresh", lifetime.Token);
            await ReloadAsync();
        }
        catch (OperationCanceledException) when (disposed) { }
        catch (Exception error) { ShowFailure("Unable to refresh after changing credentials. Use Reload marketplace to retry.", error); }
    }
#pragma warning restore VSTHRD100

    private void OnUnloaded(object sender, RoutedEventArgs eventArgs)
    {
        attached = false;
        // The WebView controller is tied to the previous native parent. Keep it alive
        // during detachment, then replace it after any pending initialization exits.
        recreateBrowser = true;
        initializationCancellation?.Cancel();
    }

    internal async Task ReloadAsync()
    {
        if (disposed) return;
        recreateBrowser = true;
        initializationCancellation?.Cancel();
        await EnsureAttachedAsync();
    }

    private async Task EnsureAttachedAsync()
    {
        if (disposed) return;
        try { await initializationGate.WaitAsync(lifetime.Token); }
        catch (OperationCanceledException) when (disposed) { return; }
        try
        {
            if (!disposed && attached) await InitializeAsync();
        }
        finally { initializationGate.Release(); }
    }

    private async System.Threading.Tasks.Task InitializeAsync()
    {
        if (disposed || initializing || (initialized && !recreateBrowser)) return;
        initializing = true;
        using var cancellation = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token);
        initializationCancellation = cancellation;
        var cancellationToken = cancellation.Token;
        try
        {
            if (recreateBrowser)
            {
                Children.Remove(browser); browser.Dispose();
                browser = new WebView2 { Visibility = Visibility.Collapsed };
                SetRow(browser, 1); Children.Insert(1, browser);
                initialized = false; recreateBrowser = false;
            }
            status.Text = "Starting AI Marketplace..."; status.Visibility = Visibility.Visible;
            browser.Visibility = Visibility.Collapsed;
            var launchUrl = await launchDashboard(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            var environment = await CoreWebView2Environment.CreateAsync(null, webViewDataFolder);
            cancellationToken.ThrowIfCancellationRequested();
            await browser.EnsureCoreWebView2Async(environment);
            cancellationToken.ThrowIfCancellationRequested();
            var activeBrowser = browser;
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
                if (Uri.TryCreate(eventArgs.Uri, UriKind.Absolute, out var target) && target.Scheme == Uri.UriSchemeHttps) MarketplacePackage.Instance?.OpenExternal(target);
            };
            browser.CoreWebView2.ProcessFailed += (_, _) =>
            {
                if (!ReferenceEquals(browser, activeBrowser)) return;
                recreateBrowser = true;
                ShowFailure("The marketplace browser stopped. Use Reload marketplace to reconnect.");
            };
            browser.CoreWebView2.NavigationCompleted += (_, eventArgs) =>
            {
                if (ReferenceEquals(browser, activeBrowser) && !eventArgs.IsSuccess) ShowFailure("The marketplace page could not load. Use Reload marketplace to reconnect.");
            };
            browser.Source = launchUrl; status.Visibility = Visibility.Collapsed; browser.Visibility = Visibility.Visible;
            initialized = true;
        }
        catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { }
        catch (Exception error)
        {
            if (disposed) return;
            ShowFailure("AI Marketplace could not start. Use Reload marketplace or Tools > Diagnose AI Marketplace.", error);
        }
        finally { initializationCancellation = null; initializing = false; }
    }

    private void ShowFailure(string message, Exception? error = null)
    {
        if (disposed) return;
        status.Text = message; browser.Visibility = Visibility.Collapsed; status.Visibility = Visibility.Visible;
        if (error is not null)
        {
            // Output services can disappear during shutdown; the visible error must
            // not turn a WPF async event into an unhandled exception.
            try { logFailure(error); } catch (Exception) { }
        }
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        Loaded -= OnLoaded;
        Unloaded -= OnUnloaded;
        PresentationSource.RemoveSourceChangedHandler(this, OnSourceChanged);
        lifetime.Cancel();
        browser.Dispose();
        lifetime.Dispose();
    }
}

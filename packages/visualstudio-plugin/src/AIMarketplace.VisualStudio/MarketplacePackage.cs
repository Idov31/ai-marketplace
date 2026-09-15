using System;
using System.ComponentModel.Design;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Task = System.Threading.Tasks.Task;

namespace AIMarketplace.VisualStudio;

[PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
[InstalledProductRegistration("AI Marketplace", "Browse and manage AI Marketplace packages", "1.1.0")]
[ProvideMenuResource("Menus.ctmenu", 1)]
[ProvideToolWindow(typeof(MarketplaceToolWindow))]
[ProvideOptionPage(typeof(MarketplaceOptions), "AI Marketplace", "General", 0, 0, true)]
[Guid(PackageGuidString)]
public sealed class MarketplacePackage : AsyncPackage
{
    public const string PackageGuidString = "1F90619F-0241-45FC-9752-6223816B05E8";
    private static readonly Guid CommandSet = new("52935F43-9F95-4865-B696-62A6A25D9873");
    private IVsOutputWindowPane? output;
    internal static MarketplacePackage? Instance { get; private set; }
    internal SidecarSupervisor Sidecar { get; private set; } = null!;

    protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
    {
        await base.InitializeAsync(cancellationToken, progress);
        Instance = this;
        await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
        output = await CreateOutputPaneAsync();
        var options = (MarketplaceOptions)GetDialogPage(typeof(MarketplaceOptions));
        Sidecar = new SidecarSupervisor(options, new WorkspaceRootService(this), new CredentialBroker(), Log);
        var commands = await GetServiceAsync(typeof(IMenuCommandService)) as OleMenuCommandService;
        if (commands is not null)
        {
            commands.AddCommand(new MenuCommand(ShowToolWindowCommand, new CommandID(CommandSet, 0x0100)));
            commands.AddCommand(new MenuCommand(RefreshCommand, new CommandID(CommandSet, 0x0101)));
            commands.AddCommand(new MenuCommand(DiagnoseCommand, new CommandID(CommandSet, 0x0102)));
            commands.AddCommand(new MenuCommand((_, _) => SaveCredential(), new CommandID(CommandSet, 0x0103)));
            commands.AddCommand(new MenuCommand((_, _) => ShowOptionPage(typeof(MarketplaceOptions)), new CommandID(CommandSet, 0x0104)));
        }
        await ShowChangelogOnceAsync(options);
    }

#pragma warning disable VSTHRD100 // MenuCommand requires a void event handler; all failures are caught here or by the called command.
    private async void ShowToolWindowCommand(object sender, EventArgs eventArgs)
    {
        try { await ShowToolWindowAsync(); }
        catch (Exception error) { Log(error.ToString()); }
    }

    private async void RefreshCommand(object sender, EventArgs eventArgs) => await RefreshAsync();
    private async void DiagnoseCommand(object sender, EventArgs eventArgs) => await DiagnoseAsync();
#pragma warning restore VSTHRD100

    private async Task ShowToolWindowAsync()
    {
        await JoinableTaskFactory.SwitchToMainThreadAsync();
        var window = await ShowToolWindowAsync(typeof(MarketplaceToolWindow), 0, true, DisposalToken);
        if (window?.Frame is not IVsWindowFrame frame) throw new NotSupportedException("Cannot create the AI Marketplace tool window.");
        ErrorHandler.ThrowOnFailure(frame.Show());
    }

    private async Task RefreshAsync()
    {
        try { Log((await Sidecar.RequestAsync("refresh", DisposalToken)).ToString()); await ShowToolWindowAsync(); }
        catch (Exception error) { Log(error.ToString()); VsShellUtilities.ShowMessageBox(this, error.Message, "AI Marketplace", OLEMSGICON.OLEMSGICON_CRITICAL, OLEMSGBUTTON.OLEMSGBUTTON_OK, OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST); }
    }

    private async Task DiagnoseAsync()
    {
        try { Log((await Sidecar.RequestAsync("diagnose", DisposalToken)).ToString()); }
        catch (Exception error) { Log(error.ToString()); }
        await JoinableTaskFactory.SwitchToMainThreadAsync();
        output?.Activate();
    }

    private void SaveCredential()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        var dialog = new CredentialDialog { Owner = Application.Current?.MainWindow };
        if (dialog.ShowDialog() == true)
        {
            new CredentialBroker().Save(dialog.Provider, dialog.SourceId, dialog.Kind, dialog.Token);
            VsShellUtilities.ShowMessageBox(this, "Credential saved in Windows Credential Manager.", "AI Marketplace", OLEMSGICON.OLEMSGICON_INFO, OLEMSGBUTTON.OLEMSGBUTTON_OK, OLEMSGDEFBUTTON.OLEMSGDEFBUTTON_FIRST);
        }
    }

    internal void OpenExternal(Uri target)
    {
        ThreadHelper.JoinableTaskFactory.Run(async () => { await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(); VsShellUtilities.OpenSystemBrowser(target.AbsoluteUri); });
    }

    internal void Log(string message)
    {
        ThreadHelper.JoinableTaskFactory.Run(async () =>
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            output?.OutputStringThreadSafe(message + Environment.NewLine);
        });
    }

    private async Task<IVsOutputWindowPane?> CreateOutputPaneAsync()
    {
        await JoinableTaskFactory.SwitchToMainThreadAsync();
        var window = await GetServiceAsync(typeof(SVsOutputWindow)) as IVsOutputWindow;
        if (window is null) return null;
        var paneGuid = new Guid("A6DD10F2-A122-405A-8E92-29D4DBB10A20");
        window.CreatePane(ref paneGuid, "AI Marketplace", 1, 1);
        window.GetPane(ref paneGuid, out var pane);
        return pane;
    }

    private async Task ShowChangelogOnceAsync(MarketplaceOptions options)
    {
        await JoinableTaskFactory.SwitchToMainThreadAsync();
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.1.0";
        if (options.LastShownVersion == version) return;
        var path = Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? string.Empty, "CHANGELOG.md");
        if (File.Exists(path)) VsShellUtilities.OpenDocument(this, path);
        options.LastShownVersion = version; options.SaveSettingsToStorage();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) Sidecar?.Dispose();
        Instance = null;
        base.Dispose(disposing);
    }
}

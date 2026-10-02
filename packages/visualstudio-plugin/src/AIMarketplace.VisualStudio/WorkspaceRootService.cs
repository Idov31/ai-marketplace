using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace AIMarketplace.VisualStudio;

internal sealed class WorkspaceRootService
{
    private readonly AsyncPackage package;

    internal WorkspaceRootService(AsyncPackage package) => this.package = package;

    internal async Task<string?> GetWorkspaceRootAsync()
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
        var solution = await package.GetServiceAsync(typeof(SVsSolution)) as IVsSolution;
        if (solution is null) return null;
        solution.GetSolutionInfo(out var directory, out var solutionFile, out _);
        if (!string.IsNullOrWhiteSpace(solutionFile)) return Path.GetDirectoryName(solutionFile);
        return !string.IsNullOrWhiteSpace(directory) && Directory.Exists(directory) ? Path.GetFullPath(directory) : null;
    }
}

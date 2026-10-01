using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using Newtonsoft.Json.Linq;

namespace AIMarketplace.VisualStudio;

internal sealed class CredentialDialog : Window
{
    private readonly ComboBox target = new() { Margin = new Thickness(0, 0, 0, 12) };
    private readonly ComboBox method = new() { Margin = new Thickness(0, 0, 0, 12) };
    private readonly PasswordBox token = new() { MaxLength = 16_384, Margin = new Thickness(0, 0, 0, 12) };
    private readonly TextBlock validation = new() { TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 8) };

    internal CredentialDialog(JObject configuration)
    {
        Title = "AI Marketplace repository authentication";
        Width = 520; SizeToContent = SizeToContent.Height;
        WindowStartupLocation = WindowStartupLocation.CenterOwner; ResizeMode = ResizeMode.NoResize;
        var panel = new StackPanel { Margin = new Thickness(18) };
        panel.Children.Add(new TextBlock { Text = "Save a PAT or access token with repository read access. Tokens are stored only in Windows Credential Manager, never in repository settings or the marketplace page.", TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 14) });
        panel.Children.Add(new TextBlock { Text = "Provider or repository" }); panel.Children.Add(target);
        panel.Children.Add(new TextBlock { Text = "Authentication method" }); panel.Children.Add(method);
        panel.Children.Add(new TextBlock { Text = "PAT / access token" }); panel.Children.Add(token);
        panel.Children.Add(new TextBlock { Text = "Shared credentials apply to a provider. Repository-specific credentials are used if shared authentication is rejected.", TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 12) });
        panel.Children.Add(validation);
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        var cancel = new Button { Content = "Cancel", MinWidth = 80, Margin = new Thickness(8, 0, 0, 0), IsCancel = true };
        var save = new Button { Content = "Save", MinWidth = 80, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
        var remove = new Button { Content = "Remove saved credential", Padding = new Thickness(8, 4, 8, 4), Margin = new Thickness(0, 0, 8, 0) };
        save.Click += (_, _) =>
        {
            var value = token.Password.Trim();
            if (value.Length < 4) { validation.Text = "Enter a non-empty PAT or access token (at least 4 characters)."; return; }
            Token = value; DialogResult = true;
        };
        remove.Click += (_, _) =>
        {
            if (MessageBox.Show(this, "Remove the saved credential for " + ((CredentialTarget)target.SelectedItem).Label + "?", "AI Marketplace", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;
            RemoveRequested = true; DialogResult = true;
        };
        target.SelectionChanged += (_, _) =>
        {
            method.ItemsSource = MethodsFor(Provider); method.SelectedIndex = 0;
            token.Clear(); validation.Text = string.Empty;
        };
        target.ItemsSource = TargetsFor(configuration); target.SelectedIndex = 0;
        buttons.Children.Add(remove); buttons.Children.Add(save); buttons.Children.Add(cancel); panel.Children.Add(buttons); Content = panel;
        Closed += (_, _) => token.Clear();
    }

    internal string Provider => ((CredentialTarget)target.SelectedItem).Provider;
    internal string? SourceId => ((CredentialTarget)target.SelectedItem).SourceId;
    internal string Kind => ((CredentialMethod)method.SelectedItem).Kind;
    internal string Token { get; private set; } = string.Empty;
    internal bool RemoveRequested { get; private set; }
    internal void ClearToken() { token.Clear(); Token = string.Empty; }

    internal static CredentialMethod[] MethodsFor(string provider) => provider switch
    {
        "github" => new[] { new CredentialMethod("bearer", "GitHub PAT / access token") },
        "azure-devops" => new[] { new CredentialMethod("basic-pat", "Azure DevOps PAT"), new CredentialMethod("bearer", "Microsoft Entra / OAuth access token") },
        "gitlab" => new[] { new CredentialMethod("private-token", "GitLab access token"), new CredentialMethod("bearer", "GitLab OAuth access token") },
        _ => throw new ArgumentException("Repository provider is unsupported.", nameof(provider))
    };

    internal static CredentialTarget[] TargetsFor(JObject configuration)
    {
        var targets = new List<CredentialTarget>
        {
            new("github", null, "Shared GitHub credential"),
            new("azure-devops", null, "Shared Azure DevOps credential"),
            new("gitlab", null, "Shared GitLab credential")
        };
        foreach (var source in (configuration["repositories"] as JArray ?? new JArray()).OfType<JObject>())
        {
            var id = source.Value<string>("id");
            var provider = SidecarSupervisor.SourceProvider(source);
            if (string.IsNullOrWhiteSpace(id)) continue;
            _ = MethodsFor(provider);
            targets.Add(new CredentialTarget(provider, id, $"Repository: {source.Value<string>("label") ?? id} ({provider}; {id})"));
        }
        return targets.ToArray();
    }
}

internal sealed class CredentialMethod
{
    internal string Kind { get; }
    private string Label { get; }
    internal CredentialMethod(string kind, string label) { Kind = kind; Label = label; }
    public override string ToString() => Label;
}

internal sealed class CredentialTarget
{
    internal string Provider { get; }
    internal string? SourceId { get; }
    internal string Label { get; }
    internal CredentialTarget(string provider, string? sourceId, string label) { Provider = provider; SourceId = sourceId; Label = label; }
    public override string ToString() => Label;
}

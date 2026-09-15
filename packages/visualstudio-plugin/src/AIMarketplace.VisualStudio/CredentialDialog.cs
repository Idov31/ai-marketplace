using System.Windows;
using System.Windows.Controls;

namespace AIMarketplace.VisualStudio;

internal sealed class CredentialDialog : Window
{
    private readonly ComboBox provider = new() { ItemsSource = new[] { "github", "azure-devops", "gitlab" }, SelectedIndex = 0, Margin = new Thickness(0, 0, 0, 8) };
    private readonly TextBox source = new() { Margin = new Thickness(0, 0, 0, 8) };
    private readonly ComboBox kind = new() { ItemsSource = new[] { "bearer", "basic-pat", "private-token" }, SelectedIndex = 0, Margin = new Thickness(0, 0, 0, 8) };
    private readonly PasswordBox token = new() { Margin = new Thickness(0, 0, 0, 12) };

    internal CredentialDialog()
    {
        Title = "Save AI Marketplace credential"; Width = 440; Height = 330; WindowStartupLocation = WindowStartupLocation.CenterOwner; ResizeMode = ResizeMode.NoResize;
        var panel = new StackPanel { Margin = new Thickness(18) };
        panel.Children.Add(new TextBlock { Text = "Provider" }); panel.Children.Add(provider);
        panel.Children.Add(new TextBlock { Text = "Repository source id (leave blank for shared)" }); panel.Children.Add(source);
        panel.Children.Add(new TextBlock { Text = "Credential kind" }); panel.Children.Add(kind);
        panel.Children.Add(new TextBlock { Text = "Credential" }); panel.Children.Add(token);
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        var cancel = new Button { Content = "Cancel", MinWidth = 80, Margin = new Thickness(8, 0, 0, 0), IsCancel = true };
        var save = new Button { Content = "Save", MinWidth = 80, IsDefault = true };
        save.Click += (_, _) => { if (!string.IsNullOrWhiteSpace(token.Password)) DialogResult = true; };
        buttons.Children.Add(save); buttons.Children.Add(cancel); panel.Children.Add(buttons); Content = panel;
    }

    internal string Provider => (string)provider.SelectedItem;
    internal string? SourceId => string.IsNullOrWhiteSpace(source.Text) ? null : source.Text.Trim();
    internal string Kind => (string)kind.SelectedItem;
    internal string Token => token.Password;
}

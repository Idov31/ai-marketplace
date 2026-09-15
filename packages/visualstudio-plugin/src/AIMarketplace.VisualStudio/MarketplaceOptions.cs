using System;
using System.ComponentModel;
using Microsoft.VisualStudio.Shell;
using Newtonsoft.Json.Linq;

namespace AIMarketplace.VisualStudio;

public enum PackagePlatform
{
    Codex,
    Cursor,
    GitHubCopilot,
    Claude
}

public sealed class MarketplaceOptions : DialogPage
{
    [Category("Packages")]
    [DisplayName("Active package platform")]
    [Description("The package target managed by the marketplace dashboard.")]
    public PackagePlatform Platform { get; set; } = PackagePlatform.Codex;

    [Category("Configuration")]
    [DisplayName("Configuration JSON")]
    [Description("Versioned repository, folder, automatic-group, and auto-update configuration. Credentials are never stored here.")]
    public string ConfigurationJson { get; set; } = "{\"schemaVersion\":1}";

    [Browsable(false)]
    public string LastShownVersion { get; set; } = string.Empty;

    internal string PlatformId => Platform switch
    {
        PackagePlatform.Cursor => "cursor",
        PackagePlatform.GitHubCopilot => "github-copilot",
        PackagePlatform.Claude => "claude",
        _ => "codex"
    };

    internal JObject GetConfiguration()
    {
        var value = JObject.Parse(string.IsNullOrWhiteSpace(ConfigurationJson) ? "{\"schemaVersion\":1}" : ConfigurationJson);
        if (value.Value<int?>("schemaVersion") != 1) throw new InvalidOperationException("AI Marketplace configuration must use schemaVersion 1.");
        RejectCredentialFields(value, "config");
        return value;
    }

    internal void SetConfiguration(JToken value)
    {
        if (value is not JObject config || config.Value<int?>("schemaVersion") != 1) throw new InvalidOperationException("Sidecar returned an invalid AI Marketplace configuration.");
        RejectCredentialFields(config, "config");
        ConfigurationJson = config.ToString(Newtonsoft.Json.Formatting.None);
        SaveSettingsToStorage();
    }

    private static void RejectCredentialFields(JToken value, string path)
    {
        if (value is JObject obj)
        {
            foreach (var property in obj.Properties())
            {
                if (System.Text.RegularExpressions.Regex.IsMatch(property.Name, "token|secret|password|credential|authorization|api[-_]?key", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                    throw new InvalidOperationException($"Credential field '{path}.{property.Name}' is not allowed in marketplace configuration.");
                RejectCredentialFields(property.Value, $"{path}.{property.Name}");
            }
        }
        else if (value is JArray array)
        {
            for (var index = 0; index < array.Count; index++) RejectCredentialFields(array[index], $"{path}[{index}]");
        }
    }
}

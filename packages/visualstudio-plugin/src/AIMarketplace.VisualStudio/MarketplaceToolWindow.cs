using System;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;

namespace AIMarketplace.VisualStudio;

[Guid("3B1B4860-7D9D-4D48-BF23-6C2DA48CC73A")]
public sealed class MarketplaceToolWindow : ToolWindowPane
{
    public MarketplaceToolWindow() : base(null)
    {
        Caption = "AI Marketplace";
        Content = new MarketplaceToolWindowControl();
    }
}

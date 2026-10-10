using System.Drawing.Imaging;
using System.Reflection;
using System.Runtime.InteropServices;

namespace DeskShot;

// Optional Windows adapter for demo-maker: renders a WinForms app's own forms to PNG and composites them
// over a screenshot of the running app. ClientBin = the app's build output folder (see deskshot.csproj).
// Usage: dotnet run -- real | new   [--out <dir>] [--backdrop <png>]
internal static class Program
{
    internal static string ClientBin;
    internal static string Out = Path.GetFullPath("screens");
    internal static string Backdrop = Path.GetFullPath(Path.Combine("..", "desktop-backdrop.png"));

    [STAThread]
    private static void Main(string[] args)
    {
        ClientBin = typeof(Program).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
            .FirstOrDefault(a => a.Key == "ClientBin")?.Value;
        AppDomain.CurrentDomain.AssemblyResolve += (_, e) =>
        {
            if (ClientBin == null) return null;
            var path = Path.Combine(ClientBin, new AssemblyName(e.Name).Name + ".dll");
            return File.Exists(path) ? Assembly.LoadFrom(path) : null;
        };
        Run(args);
    }

    // Separate method: the JIT resolves the app's types per method, so AssemblyResolve must be hooked first.
    private static void Run(string[] args)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--out") Out = Path.GetFullPath(args[i + 1]);
            if (args[i] == "--backdrop") Backdrop = Path.GetFullPath(args[i + 1]);
        }

        Application.SetHighDpiMode(HighDpiMode.SystemAware);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        ApplyClientSetup();

        Directory.CreateDirectory(Out);
        if (args.Contains("real")) Screens.Real();
        if (args.Contains("new")) Screens.New();
    }

    // Copy the app's own startup setup here (skin, accent colour, default font), or the controls look wrong.
    // DevExpress example: UserLookAndFeel.Default.SetSkinStyle(SkinStyle.WXI); WindowsFormsSettings.SetAccentColor(color);
    private static void ApplyClientSetup()
    {
    }

    internal static Bitmap Snap(Form form)
    {
        form.StartPosition = FormStartPosition.Manual;
        form.Location = new Point(60, 60);
        form.ShowInTaskbar = false;
        form.Show();
        Pump(1200);
        var bmp = new Bitmap(form.Width, form.Height);
        // A screen copy captures the lock screen or any window on top; PrintWindow asks the window to paint itself.
        using (var g = Graphics.FromImage(bmp))
        {
            var hdc = g.GetHdc();
            PrintWindow(form.Handle, hdc, PW_RENDERFULLCONTENT);
            g.ReleaseHdc(hdc);
        }
        form.Close();
        return bmp;
    }

    // Places the dialog where ShowDialog(owner) with CenterParent puts it.
    internal static Bitmap Composite(Bitmap backdrop, Bitmap dialog)
    {
        var bmp = new Bitmap(backdrop);
        using var g = Graphics.FromImage(bmp);
        var x = (backdrop.Width - dialog.Width) / 2;
        var y = (backdrop.Height - dialog.Height) / 2;
        using var shadow = new SolidBrush(Color.FromArgb(40, 0, 0, 0));
        g.FillRectangle(shadow, x + 2, y + 4, dialog.Width, dialog.Height);
        g.DrawImage(dialog, x, y);
        return bmp;
    }

    // For a changed toolbar or status line: paste the real control at its measured position on the backdrop.
    internal static Bitmap Paste(Bitmap backdrop, Control control, Point at)
    {
        control.TabStop = false;
        var part = new Bitmap(control.Width, control.Height);
        control.DrawToBitmap(part, new Rectangle(Point.Empty, control.Size));
        var bmp = new Bitmap(backdrop);
        using var g = Graphics.FromImage(bmp);
        g.DrawImage(part, at);
        return bmp;
    }

    internal static void Save(Bitmap bmp, string name) => bmp.Save(Path.Combine(Out, name), ImageFormat.Png);

    internal static void Pump(int ms)
    {
        var until = DateTime.Now.AddMilliseconds(ms);
        while (DateTime.Now < until) { Application.DoEvents(); Thread.Sleep(15); }
    }

    private const uint PW_RENDERFULLCONTENT = 2;

    [DllImport("user32.dll")]
    private static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
}

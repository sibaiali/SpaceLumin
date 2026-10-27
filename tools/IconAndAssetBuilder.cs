using System;
using System.IO;
using System.Net;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

class IconAndAssetBuilder
{
    static void Main(string[] args)
    {
        string root = args.Length > 0 ? args[0] : Directory.GetCurrentDirectory();
        string masterImg = args.Length > 1 ? args[1] : "";

        if (!File.Exists(masterImg))
        {
            Console.Error.WriteLine("Master image not found: " + masterImg);
            Environment.Exit(1);
        }

        string iconsDir = Path.Combine(root, "icons");
        Directory.CreateDirectory(iconsDir);

        int[] sizes = new int[] { 72, 96, 128, 144, 152, 192, 384, 512 };

        using (Bitmap src = new Bitmap(masterImg))
        {
            foreach (int sz in sizes)
            {
                string outPath = Path.Combine(iconsDir, "icon-" + sz + ".png");
                SaveResizedPng(src, sz, sz, outPath);
                Console.WriteLine("[Icons] Generated " + outPath);
            }

            // Additional alias filenames referenced by HTML/PWA
            SaveResizedPng(src, 192, 192, Path.Combine(iconsDir, "icon-192x192.png"));
            SaveResizedPng(src, 512, 512, Path.Combine(iconsDir, "icon-512-maskable.png"));

            // Generate multi-resolution Windows .ico (16, 32, 48, 64, 256)
            string icoPath = Path.Combine(iconsDir, "icon.ico");
            string favPath = Path.Combine(root, "favicon.ico");
            WriteMultiSizeIcon(src, new int[] { 16, 32, 48, 64, 256 }, icoPath);
            File.Copy(icoPath, favPath, true);
            Console.WriteLine("[Icons] Generated Windows ICO: " + icoPath + " & " + favPath);
        }

        // Generate clean vector SVG icon
        string svgPath = Path.Combine(iconsDir, "icon.svg");
        File.WriteAllText(svgPath, GetSvgContent());
        Console.WriteLine("[Icons] Generated " + svgPath);

        // Download offline libraries (three.min.js and Tone.js)
        string libDir = Path.Combine(root, "lib");
        Directory.CreateDirectory(libDir);
        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
        using (WebClient wc = new WebClient())
        {
            string threePath = Path.Combine(libDir, "three.min.js");
            if (!File.Exists(threePath) || new FileInfo(threePath).Length < 100000)
            {
                Console.WriteLine("[Lib] Downloading three.min.js...");
                wc.DownloadFile("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", threePath);
                Console.WriteLine("[Lib] Saved " + threePath);
            }

            string tonePath = Path.Combine(libDir, "Tone.js");
            if (!File.Exists(tonePath) || new FileInfo(tonePath).Length < 50000)
            {
                Console.WriteLine("[Lib] Downloading Tone.js...");
                wc.DownloadFile("https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js", tonePath);
                Console.WriteLine("[Lib] Saved " + tonePath);
            }
        }
    }

    static void SaveResizedPng(Bitmap src, int width, int height, string outPath)
    {
        using (Bitmap dst = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(dst))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.SmoothingMode = SmoothingMode.HighQuality;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.CompositingQuality = CompositingQuality.HighQuality;
                g.DrawImage(src, new Rectangle(0, 0, width, height));
            }
            dst.Save(outPath, ImageFormat.Png);
        }
    }

    static void WriteMultiSizeIcon(Bitmap src, int[] sizes, string icoPath)
    {
        byte[][] pngBuffers = new byte[sizes.Length][];
        for (int i = 0; i < sizes.Length; i++)
        {
            int sz = sizes[i];
            using (Bitmap dst = new Bitmap(sz, sz, PixelFormat.Format32bppArgb))
            {
                using (Graphics g = Graphics.FromImage(dst))
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.DrawImage(src, new Rectangle(0, 0, sz, sz));
                }
                using (MemoryStream ms = new MemoryStream())
                {
                    dst.Save(ms, ImageFormat.Png);
                    pngBuffers[i] = ms.ToArray();
                }
            }
        }

        using (FileStream fs = new FileStream(icoPath, FileMode.Create, FileAccess.Write))
        using (BinaryWriter bw = new BinaryWriter(fs))
        {
            // ICONDIR header
            bw.Write((ushort)0); // Reserved
            bw.Write((ushort)1); // Type: 1 = ICO
            bw.Write((ushort)sizes.Length); // Count

            int offset = 6 + (16 * sizes.Length);
            for (int i = 0; i < sizes.Length; i++)
            {
                int sz = sizes[i];
                bw.Write((byte)(sz >= 256 ? 0 : sz)); // Width
                bw.Write((byte)(sz >= 256 ? 0 : sz)); // Height
                bw.Write((byte)0); // ColorCount
                bw.Write((byte)0); // Reserved
                bw.Write((ushort)1); // Planes
                bw.Write((ushort)32); // BitCount
                bw.Write((uint)pngBuffers[i].Length); // BytesInRes
                bw.Write((uint)offset); // ImageOffset
                offset += pngBuffers[i].Length;
            }

            for (int i = 0; i < sizes.Length; i++)
            {
                bw.Write(pngBuffers[i]);
            }
        }
    }

    static string GetSvgContent()
    {
        return @"<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 512 512"">
  <defs>
    <radialGradient id=""bg"" cx=""50%"" cy=""50%"" r=""60%"">
      <stop offset=""0%"" stop-color=""#1e1b4b""/>
      <stop offset=""55%"" stop-color=""#090d16""/>
      <stop offset=""100%"" stop-color=""#020617""/>
    </radialGradient>
    <linearGradient id=""wing"" x1=""0%"" y1=""0%"" x2=""100%"" y2=""100%"">
      <stop offset=""0%"" stop-color=""#22d3ee""/>
      <stop offset=""100%"" stop-color=""#0284c7""/>
    </linearGradient>
    <linearGradient id=""gold"" x1=""0%"" y1=""0%"" x2=""0%"" y2=""100%"">
      <stop offset=""0%"" stop-color=""#fef08a""/>
      <stop offset=""100%"" stop-color=""#c8aa6e""/>
    </linearGradient>
  </defs>
  <rect width=""512"" height=""512"" rx=""96"" fill=""url(#bg)""/>
  <circle cx=""256"" cy=""256"" r=""196"" fill=""none"" stroke=""#c8aa6e"" stroke-width=""4"" stroke-opacity=""0.45""/>
  <circle cx=""256"" cy=""256"" r=""150"" fill=""none"" stroke=""#a855f7"" stroke-width=""6"" stroke-dasharray=""24 14"" stroke-opacity=""0.65""/>
  <circle cx=""256"" cy=""256"" r=""112"" fill=""none"" stroke=""#22d3ee"" stroke-width=""3"" stroke-opacity=""0.5""/>
  <polygon points=""256,76 318,292 256,254 194,292"" fill=""url(#wing)""/>
  <polygon points=""256,110 398,326 292,300 256,240"" fill=""#0ac8b9"" fill-opacity=""0.85""/>
  <polygon points=""256,110 114,326 220,300 256,240"" fill=""#0ac8b9"" fill-opacity=""0.85""/>
  <polygon points=""256,64 278,220 256,244 234,220"" fill=""url(#gold)""/>
  <circle cx=""256"" cy=""330"" r=""24"" fill=""#fef08a""/>
  <polygon points=""236,334 276,334 256,438"" fill=""#22d3ee"" fill-opacity=""0.9""/>
</svg>";
    }
}

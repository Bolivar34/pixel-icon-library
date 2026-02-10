const fs = require("fs");
const path = require("path");

// Fix for Windows: fantasticon's glob patterns fail with backslash path separators.
// path.join produces "icons\SVG\**\*.svg" but glob needs "icons/SVG/**/*.svg".
// https://github.com/tancredi/fantasticon/issues/528
if (process.platform === "win32") {
  const originalJoin = path.join;
  path.join = function (...args) {
    return originalJoin.apply(this, args).replace(/\\/g, "/");
  };
}

// Ensure glob returns files in sorted alphabetical order so ALL generated
// font files (SVG, TTF, WOFF, WOFF2, EOT, CSS) have glyphs in consistent
// alphabetical order: brands → purcats → regular → solid.
const globModule = require("glob");
const originalGlob = globModule.glob;
globModule.glob = async function (...args) {
  const results = await originalGlob.apply(this, args);
  return results.sort();
};

// Build codepoints alphabetically (brands → purcats → regular → solid),
// matching the original webfonts-generator order. New icons added to any
// category will sort into place automatically on the next generation.
const svgRoot = path.resolve("icons", "SVG");
const codepoints = {};
let code = 0xf101;

for (const dir of fs.readdirSync(svgRoot).sort()) {
  const dirPath = path.join(svgRoot, dir);
  if (!fs.statSync(dirPath).isDirectory()) continue;

  for (const file of fs.readdirSync(dirPath).filter((f) => f.endsWith(".svg")).sort()) {
    codepoints[path.basename(file, ".svg")] = code++;
  }
}

// Use CJS require so fantasticon picks up our patched glob above.
const { generateFonts } = require("fantasticon");

(async () => {
  try {
    await generateFonts({
      inputDir: "./icons/SVG",
      outputDir: "./fonts",
      name: "iconfont",
      fontTypes: ["eot", "woff2", "woff", "ttf", "svg"],
      assetTypes: ["css"],
      prefix: "hn",
      fontHeight: 24,
      codepoints,
      getIconId: ({ basename }) => basename,
      templates: {
        css: "./scripts/css.hbs",
      },
    });
    console.log("Done!");
  } catch (error) {
    console.log("Fail!", error);
  }
})();

const path = require("path");

module.exports = (env, argv) => {
  const isProd = argv && argv.mode === "production";
  return {
    entry: "./src/index.jsx",
    output: {
      path: path.resolve(__dirname, "app/js"),
      filename: "bundle.js",
      clean: false,
    },
    resolve: {
      extensions: [".js", ".jsx"],
    },
    // ZOHO se carga por CDN en widget.html; webpack no debe bundlearlo.
    externals: {
      ZOHO: "ZOHO",
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: "babel-loader",
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    // Sin source map en producción: ZET no permite empacar archivos .map.
    devtool: isProd ? false : "source-map",
  };
};

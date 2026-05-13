import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["public/app/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        FormData: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        ImageCapture: "readonly",
        BarcodeDetector: "readonly",
        navigator: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        console: "readonly"
      }
    }
  }
];

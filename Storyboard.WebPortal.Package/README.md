# Storyboard.WebPortal

This package contains the compiled Storyboard WebPortal static content.

When referenced by an SDK-style .NET project, the package copies its files into the consuming project's `wwwroot` output and publish directories. The host can then serve the files with its normal ASP.NET Core static-file configuration.

The package is built from the WebPortal Vite `dist` directory and does not contain the source tree or Node.js dependencies.

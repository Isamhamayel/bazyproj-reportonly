# BazyGo Reports Only

This is a standalone version of the Reports page extracted from the original Figma-generated React/Vite project.

## What was changed

- Removed login requirement
- Removed sidebar/menu layout
- Set the app to open directly on the Reports page
- Configured Vite with relative asset paths so it can be hosted on GitHub Pages

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm install
npm run build
```

The production files will be created in `dist/`.

## Host on GitHub Pages

### Option 1: Manual static hosting

1. Create a new GitHub repository
2. Upload this project
3. Run build locally:

```bash
npm install
npm run build
```

4. Upload the contents of `dist/` to the branch you use for Pages hosting, or deploy with your preferred GitHub Pages workflow

### Option 2: GitHub Pages with Actions

Create `.github/workflows/deploy.yml` with this content:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm install
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then in GitHub repository settings, enable GitHub Pages to deploy from GitHub Actions.

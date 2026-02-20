import { Template } from './types';

const SIMPLE_CSS = `
body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  color: #1a1a1a;
  background: #f9fafb;
}
header {
  text-align: center;
  margin-bottom: 3rem;
}
h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: #4f46e5;
}
.card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  margin-bottom: 2rem;
}
.button {
  display: inline-block;
  background: #4f46e5;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
}
.button:hover {
  background: #4338ca;
}
footer {
  text-align: center;
  color: #6b7280;
  margin-top: 4rem;
  font-size: 0.875rem;
}
`;

export const TEMPLATES: Template[] = [
  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'A simple minimalist landing page.',
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>Hello, World!</h1>
        <p>Welcome to my new website hosted on GitHub Pages.</p>
    </header>
    <main class="card">
        <h2>About This Site</h2>
        <p>This site was deployed instantly using GitPage Deployer. It lives on the edge and is served by GitHub's robust infrastructure.</p>
        <br>
        <a href="#" class="button">Get Started</a>
    </main>
    <footer>
        <p>&copy; ${new Date().getFullYear()} My Website</p>
    </footer>
</body>
</html>`,
      'style.css': SIMPLE_CSS
    }
  },
  {
    id: 'portfolio',
    name: 'Simple Portfolio',
    description: 'Showcase your work with a clean layout.',
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Portfolio</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>My Portfolio</h1>
        <p>Designer. Developer. Creator.</p>
    </header>
    <main>
        <div class="card">
            <h3>Project One</h3>
            <p>A revolutionary app that changes how we view the web.</p>
        </div>
        <div class="card">
            <h3>Project Two</h3>
            <p>An artistic exploration of color and space.</p>
        </div>
        <div class="card">
            <h3>Contact Me</h3>
            <p>Ready to work together? Send me a message.</p>
            <br>
            <a href="mailto:email@example.com" class="button">Email Me</a>
        </div>
    </main>
    <footer>
        <p>Built with GitHub Pages</p>
    </footer>
</body>
</html>`,
      'style.css': SIMPLE_CSS
    }
  },
  {
    id: 'coming-soon',
    name: 'Coming Soon',
    description: 'A placeholder page for your future project.',
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Coming Soon</title>
    <style>
        body { font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; color: white; margin: 0; }
        h1 { font-size: 4rem; margin: 0; letter-spacing: -2px; }
        p { color: #888; font-size: 1.25rem; }
    </style>
</head>
<body>
    <h1>Coming Soon</h1>
    <p>Something amazing is being built here.</p>
</body>
</html>`
    }
  }
];
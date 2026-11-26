import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const CHROME_PATH =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const RASTER_JOBS = [
  ...['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal', 'brown', 'silver'].map(
    (id) => ({
      src: `artwork/bottles/${id}.svg`,
      dest: `public/assets/bottles/${id}.png`,
      width: 256,
      height: 512,
      mime: 'image/png',
    }),
  ),
  {
    src: 'artwork/environment/background.svg',
    dest: 'public/assets/environment/background.webp',
    width: 1280,
    height: 720,
    mime: 'image/webp',
    quality: 0.9,
  },
  {
    src: 'artwork/environment/shelf.svg',
    dest: 'public/assets/environment/shelf.png',
    width: 1024,
    height: 56,
    mime: 'image/png',
  },
  {
    src: 'artwork/environment/shelf-edge.svg',
    dest: 'public/assets/environment/shelf-edge.png',
    width: 1024,
    height: 32,
    mime: 'image/png',
  },
  {
    src: 'artwork/environment/hidden-compartment.svg',
    dest: 'public/assets/environment/hidden-compartment.png',
    width: 1024,
    height: 156,
    mime: 'image/png',
  },
  {
    src: 'artwork/environment/hidden-slot.svg',
    dest: 'public/assets/environment/hidden-slot.png',
    width: 128,
    height: 128,
    mime: 'image/png',
  },
  {
    src: 'artwork/effects/bottle-shadow.svg',
    dest: 'public/assets/effects/bottle-shadow.png',
    width: 256,
    height: 64,
    mime: 'image/png',
  },
  {
    src: 'artwork/effects/selection-glow.svg',
    dest: 'public/assets/effects/selection-glow.png',
    width: 320,
    height: 576,
    mime: 'image/png',
  },
  {
    src: 'artwork/effects/sparkle.svg',
    dest: 'public/assets/effects/sparkle.png',
    width: 64,
    height: 64,
    mime: 'image/png',
  },
  {
    src: 'artwork/effects/particle.svg',
    dest: 'public/assets/effects/particle.png',
    width: 32,
    height: 32,
    mime: 'image/png',
  },
];

async function main() {
  const payload = RASTER_JOBS.map((job) => ({
    ...job,
    svg: readFileSync(join(ROOT, job.src), 'utf8'),
  }));

  const html = `<!doctype html>
<html>
  <body>
    <pre id="out">PENDING</pre>
    <script>
      const jobs = ${JSON.stringify(payload)};
      async function renderOne(job) {
        const blob = new Blob([job.svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          img.width = job.width;
          img.height = job.height;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });
          const canvas = document.createElement('canvas');
          canvas.width = job.width;
          canvas.height = job.height;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, job.width, job.height);
          ctx.drawImage(img, 0, 0, job.width, job.height);
          const dataUrl =
            job.quality !== undefined
              ? canvas.toDataURL(job.mime, job.quality)
              : canvas.toDataURL(job.mime);
          return { dest: job.dest, dataUrl };
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      Promise.all(jobs.map(renderOne))
        .then((results) => {
          document.getElementById('out').textContent = JSON.stringify(results);
        })
        .catch((err) => {
          document.getElementById('out').textContent = 'ERROR:' + String(err);
        });
    </script>
  </body>
</html>`;

  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  try {
    const { stdout: dumped } = await execFileAsync(
      CHROME_PATH,
      [
        '--headless=new',
        '--disable-gpu',
        '--virtual-time-budget=5000',
        '--dump-dom',
        `http://127.0.0.1:${String(port)}/`,
      ],
      { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
    );

    const match = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dumped);
    if (!match?.[1] || match[1].startsWith('ERROR:') || match[1] === 'PENDING') {
      throw new Error(`Rasterisation failed: ${match?.[1] ?? 'empty output'}`);
    }

    const results = JSON.parse(match[1]);
    let totalBytes = 0;

    for (const item of results) {
      const base64 = item.dataUrl.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      const fullPath = join(ROOT, item.dest);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, buffer);
      totalBytes += buffer.length;
    }

    console.log(
      `Rasterised ${String(results.length)} runtime textures (${(totalBytes / 1024).toFixed(1)} KB total).`,
    );
  } finally {
    server.close();
  }
}

void main();

import React, { useEffect, useState } from 'react';

const PROJECTS_KEY = 'vibePilot_savedProjects';
const PREFERENCES_KEY = 'vibePilot_userPreferences';
const DURATIONS = ['5s', '10s', '15s', '30s', '60s'];

function readLocal(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function absoluteUrl(value, base) {
  try {
    const resolved = new URL(value, base);
    return ['http:', 'https:'].includes(resolved.protocol) ? resolved.href : null;
  } catch {
    return null;
  }
}

function extractWebsite(html, sourceUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const metaContent = (selector) => cleanText(doc.querySelector(selector)?.getAttribute('content'));

  const title = cleanText(doc.title);
  const description =
    metaContent('meta[name="description"]') ||
    metaContent('meta[property="og:description"]') ||
    metaContent('meta[name="twitter:description"]');

  const headlineCandidates = [
    metaContent('meta[property="og:title"]'),
    metaContent('meta[name="twitter:title"]'),
    ...Array.from(doc.querySelectorAll('h1, h2')).map((node) => cleanText(node.textContent)),
    title,
  ];
  const headlines = [...new Set(headlineCandidates.filter((item) => item && item.length > 3))].slice(0, 8);

  const ctaPattern = /\b(get started|start now|shop now|buy now|book (now|a demo)|learn more|contact us|sign up|try (it|now|for free)|request (a )?(demo|quote)|schedule|subscribe|discover|explore|join now|download)\b/i;
  const ctas = [...doc.querySelectorAll('a, button, input[type="submit"]')]
    .map((node) => cleanText(node.textContent || node.value || node.getAttribute('aria-label')))
    .filter((text) => text && text.length < 90 && ctaPattern.test(text));
  const uniqueCtas = [...new Set(ctas)].slice(0, 8);

  const paragraphs = [...doc.querySelectorAll('main p, article p, section p, p')]
    .map((node) => cleanText(node.textContent))
    .filter((text) => text.length > 45 && text.length < 700);
  const uniqueParagraphs = [...new Set(paragraphs)].slice(0, 12);

  const sectionHeading = (paragraph) => {
    const parent = paragraph.closest('section, article, li, div');
    const heading = parent?.querySelector('h1, h2, h3');
    return cleanText(heading?.textContent) || title || 'Company offering';
  };

  const productDescriptions = uniqueParagraphs.slice(0, 6).map((text, index) => ({
    name: sectionHeading(doc.querySelectorAll('main p, article p, section p, p')[index]) || `Offering ${index + 1}`,
    description: text,
  }));

  const missionTerms = /\b(our mission|our purpose|why we|what we believe|our vision|who we are)\b/i;
  const missionStatement =
    uniqueParagraphs.find((text) => missionTerms.test(text)) ||
    description ||
    uniqueParagraphs.slice().sort((a, b) => b.length - a.length)[0] ||
    '';

  const mediaAssets = [];
  const addAsset = (url, type) => {
    const resolved = absoluteUrl(url, sourceUrl);
    if (resolved && !mediaAssets.some((asset) => asset.url === resolved)) {
      mediaAssets.push({ url: resolved, type });
    }
  };

  addAsset(metaContent('meta[property="og:image"]'), 'Image');
  addAsset(metaContent('meta[name="twitter:image"]'), 'Image');
  [...doc.querySelectorAll('img')].forEach((image) => {
    const width = Number(image.getAttribute('width') || image.naturalWidth || 0);
    const height = Number(image.getAttribute('height') || image.naturalHeight || 0);
    const candidate = image.getAttribute('src') || image.getAttribute('data-src') ||
      image.getAttribute('data-lazy-src') || image.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0];
    if ((!width || width >= 500) && (!height || height >= 280)) addAsset(candidate, 'Image');
  });
  [...doc.querySelectorAll('video, video source')].forEach((video) => {
    addAsset(video.getAttribute('src') || video.getAttribute('poster'), 'Video');
  });

  return {
    headlines,
    ctas: uniqueCtas,
    productDescriptions,
    missionStatement,
    mediaAssets: mediaAssets.slice(0, 12),
  };
}

function companyNameFromUrl(sourceUrl) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '').split('.')[0]
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return 'Your brand';
  }
}

function createPackages(sourceUrl, content) {
  const company = companyNameFromUrl(sourceUrl);
  const offering = content.productDescriptions[0]?.description || content.missionStatement ||
    `${company} helps customers find a better way forward.`;
  const headline = content.headlines[0] || `Meet a smarter way with ${company}.`;
  const cta = content.ctas[0] || 'Discover more today';
  const projectId = `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const generatedAt = new Date().toISOString();

  const templates = {
    '5s': [
      { time: '0:00–0:02', label: 'The hook', voiceover: `${headline}`, visual: 'Open with a bold, attention-grabbing brand moment.' },
      { time: '0:02–0:05', label: 'The invitation', voiceover: `${company}. ${cta}.`, visual: 'Finish on a clear brand frame and a memorable call to action.' },
    ],
    '10s': [
      { time: '0:00–0:03', label: 'The hook', voiceover: `${headline}`, visual: 'Lead with a quick, striking moment that captures attention.' },
      { time: '0:03–0:07', label: 'The value', voiceover: `${company} makes it easier to get more from every day. ${offering}`, visual: 'Show the offering in action and focus on one compelling benefit.' },
      { time: '0:07–0:10', label: 'The invitation', voiceover: `${cta}.`, visual: 'Close on the brand with a concise, readable call to action.' },
    ],
    '15s': [
      { time: '0:00–0:03', label: 'The hook', voiceover: `${headline}`, visual: 'Open with a bold, close-up moment that captures the audience’s attention.' },
      { time: '0:03–0:10', label: 'The value', voiceover: `${company} makes it easier to get more from every day. ${offering}`, visual: 'Show the product or service in use, then reveal its most compelling benefit.' },
      { time: '0:10–0:15', label: 'The invitation', voiceover: `Make your next move with ${company}. ${cta}.`, visual: 'Finish on a confident brand frame with a clear, readable call to action.' },
    ],
    '30s': [
      { time: '0:00–0:04', label: 'The hook', voiceover: `${headline}`, visual: 'Start with a recognizable customer challenge and an immediate visual pattern-break.' },
      { time: '0:04–0:12', label: 'The opportunity', voiceover: `There’s a better way to get what you need. ${company} is built to help people move forward with confidence.`, visual: 'Show the audience’s everyday context, then introduce the brand naturally.' },
      { time: '0:12–0:23', label: 'The solution', voiceover: `${offering} With ${company}, the right next step feels refreshingly straightforward.`, visual: 'Demonstrate the offering and highlight a specific benefit with crisp product details.' },
      { time: '0:23–0:30', label: 'The invitation', voiceover: `Ready to see what’s possible? ${cta}.`, visual: 'Close with a warm brand shot, logo, and a single prominent call to action.' },
    ],
    '60s': [
      { time: '0:00–0:06', label: 'The hook', voiceover: `${headline}`, visual: 'Lead with a striking scene that reflects the need your audience is trying to solve.' },
      { time: '0:06–0:16', label: 'The challenge', voiceover: `You have enough to think about without settling for an experience that makes things harder. It’s time for a better way.`, visual: 'Build a brief, relatable picture of the friction or unmet need.' },
      { time: '0:16–0:29', label: 'Meet the brand', voiceover: `Meet ${company}. ${content.missionStatement || `${company} is here to make a meaningful difference for its customers.`}`, visual: 'Introduce the people, product, or service behind the brand with authentic imagery.' },
      { time: '0:29–0:43', label: 'Show the solution', voiceover: `${offering} It’s a thoughtful way to bring more ease, clarity, and confidence to the experience.`, visual: 'Walk through the offering in action, focusing on clear benefits rather than feature overload.' },
      { time: '0:43–0:53', label: 'The payoff', voiceover: `Because when the right solution fits your life, you can spend more time focused on what matters. That’s the difference ${company} is working to make.`, visual: 'Show a satisfying customer outcome and a genuine human moment.' },
      { time: '0:53–1:00', label: 'The invitation', voiceover: `Take the next step and experience it for yourself. ${cta}.`, visual: 'End on the brand, website, and one high-contrast call to action.' },
    ],
  };

  return DURATIONS.map((duration) => {
    const beats = templates[duration];
    return {
      projectId,
      sourceUrl,
      duration,
      script: beats.map((beat) => beat.voiceover).join(' '),
      visualCues: beats.map((beat, index) => ({
        time: beat.time,
        description: `${beat.label}: ${beat.visual}`,
        suggestedAssetId: content.mediaAssets[index]?.url || 'brand-shot',
      })),
      cta,
      generationDate: generatedAt,
      beats,
    };
  });
}

function shortDate(value) {
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Saved project';
  }
}

export default function App() {
  const [projects, setProjects] = useState(() => readLocal(PROJECTS_KEY, []));
  const [preferences, setPreferences] = useState(() =>
    readLocal(PREFERENCES_KEY, { defaultDuration: '30s', theme: 'light' })
  );
  const [url, setUrl] = useState('');
  const [inputError, setInputError] = useState('');
  const [screen, setScreen] = useState('home');
  const [stage, setStage] = useState('scraping');
  const [project, setProject] = useState(null);
  const [activeDuration, setActiveDuration] = useState(preferences.defaultDuration || '30s');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [scriptEditing, setScriptEditing] = useState(false);
  const [draftScript, setDraftScript] = useState('');
  const [scriptError, setScriptError] = useState('');

  const dark = preferences.theme === 'dark';
  const page = dark ? 'min-h-screen bg-slate-950 text-slate-100' : 'min-h-screen bg-slate-50 text-slate-900';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const card = dark ? 'rounded-2xl border border-slate-800 bg-slate-900 shadow-sm' : 'rounded-2xl border border-slate-200 bg-white shadow-sm';
  const inputClass = dark
    ? 'w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20'
    : 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20';

  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    } catch {
      // The app remains usable when storage is unavailable.
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Preferences are optional when storage is unavailable.
    }
  }, [preferences]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    try {
      const hash = window.location.hash;
      if (!hash.startsWith('#project=')) return;
      const shared = JSON.parse(decodeURIComponent(hash.slice('#project='.length)));
      if (shared?.packages?.length) {
        setProject(shared);
        setActiveDuration(shared.packages.some((item) => item.duration === preferences.defaultDuration)
          ? preferences.defaultDuration : '30s');
        setScreen('results');
      }
    } catch {
      setToast('This shared project link could not be opened.');
    }
  }, []);

  const updatePreference = (key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    if (key === 'defaultDuration') setActiveDuration(value);
  };

  const generate = async (event, overrideUrl) => {
    event?.preventDefault();
    const submitted = (overrideUrl ?? url).trim();
    if (!submitted) {
      setInputError('A URL is required to begin generation.');
      return;
    }

    let parsed;
    try {
      parsed = new URL(/^https?:\/\//i.test(submitted) ? submitted : `https://${submitted}`);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) throw new Error('Invalid URL');
    } catch {
      setInputError('Please enter a valid URL format.');
      return;
    }

    const sourceUrl = parsed.href;
    setUrl(sourceUrl);
    setInputError('');
    setProject(null);
    setShareUrl('');
    setScriptEditing(false);
    setScriptError('');
    setScreen('loading');
    setStage('scraping');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let response;
      try {
        response = await fetch(sourceUrl, { signal: controller.signal, redirect: 'follow' });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw new Error('Website request failed');
      setStage('parsing');
      const html = await response.text();
      if (!html || html.length < 100) throw new Error('Website response was empty');

      const extractedContent = extractWebsite(html, sourceUrl);
      const textAmount = extractedContent.headlines.join(' ').length +
        extractedContent.productDescriptions.map((item) => item.description).join(' ').length +
        extractedContent.missionStatement.length;
      if (!textAmount || textAmount < 80) {
        setScreen('insufficient');
        return;
      }

      setStage('generating');
      await new Promise((resolve) => setTimeout(resolve, 450));
      const packages = createPackages(sourceUrl, extractedContent);
      if (!packages.length || packages.some((item) => !item.script)) throw new Error('Commercial generation failed');

      setProject({
        projectId: packages[0].projectId,
        sourceUrl,
        status: extractedContent.headlines.length > 0 && extractedContent.productDescriptions.length > 0
          ? 'Success' : 'Partial',
        extractedContent,
        packages,
        createdAt: new Date().toISOString(),
      });
      setActiveDuration(preferences.defaultDuration || '30s');
      setScreen('results');
    } catch (error) {
      setScreen(error?.message === 'Commercial generation failed' ? 'generationError' : 'failure');
    }
  };

  const openSavedProject = (saved) => {
    setProject(saved);
    setActiveDuration(saved.packages?.some((item) => item.duration === preferences.defaultDuration)
      ? preferences.defaultDuration : '30s');
    setDetailsOpen(false);
    setShareUrl('');
    setScriptEditing(false);
    setScriptError('');
    setScreen('results');
  };

  const saveProject = () => {
    if (!project) return;
    setProjects((current) => [project, ...current.filter((item) => item.projectId !== project.projectId)]);
    setToast('Project saved to your history ✓');
  };

  const deleteProject = (projectId) => {
    setProjects((current) => current.filter((item) => item.projectId !== projectId));
    setToast('Project removed from history.');
  };

  const exportProject = () => {
    if (!project) return;
    try {
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${companyNameFromUrl(project.sourceUrl).toLowerCase().replace(/\s+/g, '-')}-commercials.json`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setToast('Project JSON exported.');
    } catch {
      setToast('Export could not be started. Please try again.');
    }
  };

  const shareProject = async () => {
    if (!project) return;
    const nextShareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#project=${encodeURIComponent(JSON.stringify(project))}`;
    setShareUrl(nextShareUrl);
    try {
      await navigator.clipboard.writeText(nextShareUrl);
      setToast('Share link copied to clipboard.');
    } catch {
      setToast('Share link ready below — select and copy it.');
    }
  };

  const activePackage = project?.packages?.find((item) => item.duration === activeDuration);
  const isSaved = project && projects.some((item) => item.projectId === project.projectId);

  const saveScriptEdit = () => {
    const nextScript = draftScript.trim();
    if (!nextScript) {
      setScriptError('The script cannot be empty.');
      return;
    }
    const updatedProject = {
      ...project,
      packages: project.packages.map((item) =>
        item.duration === activeDuration ? { ...item, script: nextScript } : item
      ),
    };
    setProject(updatedProject);
    if (isSaved) {
      setProjects((current) => current.map((item) =>
        item.projectId === updatedProject.projectId ? updatedProject : item
      ));
    }
    setScriptEditing(false);
    setScriptError('');
    setToast('Script changes saved.');
  };

  return (
    <div className={page}>
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-slate-200/70 py-5 dark:border-slate-800">
          <button onClick={() => { setScreen('home'); setProject(null); setScriptEditing(false); }} className="flex items-center gap-3 text-left" aria-label="Go to home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 text-lg font-black text-white shadow-lg shadow-violet-500/20">S</span>
            <span>
              <span className="block text-sm font-bold tracking-tight">Spotlight Studio</span>
              <span className={`block text-xs ${muted}`}>Creative, grounded in your brand</span>
            </span>
          </button>
          <div className="flex items-center gap-3">
            <label className={`hidden text-xs font-medium sm:block ${muted}`} htmlFor="default-duration">Default length</label>
            <select id="default-duration" value={preferences.defaultDuration || '30s'} onChange={(event) => updatePreference('defaultDuration', event.target.value)} className={`${dark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-700'} rounded-lg border px-2.5 py-2 text-xs font-semibold outline-none`}>
              {DURATIONS.map((duration) => <option key={duration} value={duration}>{duration}</option>)}
            </select>
            <button onClick={() => updatePreference('theme', dark ? 'light' : 'dark')} className={`${dark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-700'} rounded-lg border px-3 py-2 text-xs font-semibold transition hover:border-violet-400`} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}>
              {dark ? '☀ Light' : '☾ Dark'}
            </button>
          </div>
        </header>

        {screen === 'home' && (
          <main className="mx-auto max-w-4xl pt-12 sm:pt-16">
            <div className="mb-10 max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> WEBSITE TO COMMERCIAL, MADE SIMPLE
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Turn your website into <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">your next great ad.</span></h1>
              <p className={`mt-5 max-w-xl text-base leading-7 sm:text-lg ${muted}`}>We’ll analyze your brand’s public messaging and draft ready-to-refine 15, 30, and 60-second commercial scripts.</p>
            </div>

            <div className={`${card} p-5 sm:p-7`}>
              <form onSubmit={(event) => generate(event)} noValidate>
                <label htmlFor="website-url" className="mb-2 block text-sm font-semibold">Company website</label>
                <div className="relative">
                  <span className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg ${muted}`}>↗</span>
                  <input
                    id="website-url"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://yourcompany.com"
                    value={url}
                    onChange={(event) => { setUrl(event.target.value); setInputError(''); }}
                    className={`${inputClass} pl-11`}
                    aria-invalid={Boolean(inputError && inputError.includes('valid URL'))}
                    aria-describedby={inputError ? 'url-error' : undefined}
                  />
                </div>
                {inputError && inputError.includes('valid URL') && <p id="url-error" className="mt-2 text-sm text-red-600">{inputError}</p>}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:-translate-y-0.5 hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-300">
                    Generate commercial <span aria-hidden="true">→</span>
                  </button>
                  {inputError && inputError.includes('required') && <p className="text-sm text-red-600">{inputError}</p>}
                  <p className={`text-xs leading-5 ${muted}`}>Uses public page content. Results are drafts for your creative team.</p>
                </div>
              </form>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ['01', 'Analyze your site', 'Find brand messages, offerings, CTAs, and available media.'],
                ['02', 'Draft three lengths', 'Get distinct scripts with scene-by-scene timing and visual cues.'],
                ['03', 'Save and share', 'Keep projects on this device or export them as JSON.'],
              ].map(([number, title, description]) => (
                <div key={number} className={`${card} p-5 transition hover:-translate-y-0.5`}>
                  <span className="text-xs font-bold tracking-widest text-violet-600">{number}</span>
                  <h2 className="mt-3 text-sm font-bold">{title}</h2>
                  <p className={`mt-2 text-sm leading-6 ${muted}`}>{description}</p>
                </div>
              ))}
            </div>

            <section className="mt-12">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Saved projects</h2>
                  <p className={`mt-1 text-sm ${muted}`}>Your project history is stored in this browser.</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{projects.length}</span>
              </div>
              {projects.length === 0 ? (
                <div className={`${card} border-dashed p-7 text-center`}>
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-xl text-violet-600 dark:bg-violet-950">✦</div>
                  <p className="mt-3 text-sm font-semibold">Your saved work will show up here</p>
                  <p className={`mt-1 text-sm ${muted}`}>Generate a commercial, then save it to revisit later.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((saved) => (
                    <ProjectRow key={saved.projectId} saved={saved} dark={dark} muted={muted} onOpen={() => openSavedProject(saved)} onDelete={() => deleteProject(saved.projectId)} />
                  ))}
                </div>
              )}
            </section>
          </main>
        )}

        {screen === 'loading' && (
          <main className="mx-auto max-w-2xl pt-16 sm:pt-24">
            <section className={`${card} p-7 sm:p-10`}>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin dark:border-slate-700 dark:border-t-violet-400" aria-label="Loading" />
              <p className="mt-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-violet-600">Working on your commercial</p>
              <h1 className="mt-2 text-center text-2xl font-bold tracking-tight">{stage === 'scraping' ? 'Analyzing website content…' : stage === 'parsing' ? 'Finding the best brand details…' : 'Drafting your scripts…'}</h1>
              <p className={`mx-auto mt-3 max-w-md text-center text-sm leading-6 ${muted}`}>This can take a moment. The site must allow requests from your browser for its content to be analyzed.</p>
              <div className="mt-8 space-y-3">
                {[
                  ['scraping', 'Analyzing website'],
                  ['parsing', 'Parsing brand content'],
                  ['generating', 'Drafting commercial scripts'],
                ].map(([key, label], index) => {
                  const keys = ['scraping', 'parsing', 'generating'];
                  const active = keys.indexOf(stage) === index;
                  const complete = keys.indexOf(stage) > index;
                  return (
                    <div key={key} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${active ? 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200' : dark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${complete ? 'bg-emerald-500 text-white' : active ? 'bg-violet-600 text-white' : dark ? 'bg-slate-800' : 'bg-slate-100'}`}>{complete ? '✓' : index + 1}</span>
                      <span className="text-sm font-medium">{label}</span>
                      {active && <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />}
                    </div>
                  );
                })}
              </div>
            </section>
          </main>
        )}

        {(screen === 'failure' || screen === 'insufficient' || screen === 'generationError') && (
          <main className="mx-auto max-w-xl pt-16 sm:pt-24">
            <section className={`${card} p-7 text-center sm:p-10`}>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-xl text-amber-600 dark:bg-amber-950/40">!</div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight">
                {screen === 'insufficient' ? 'Not quite enough to work with' : screen === 'generationError' ? 'Script generation hit a snag' : 'We couldn’t reach that website'}
              </h1>
              <p className={`mt-3 text-sm leading-6 ${muted}`}>
                {screen === 'insufficient'
                  ? 'Could not find enough marketing content on this site to generate a full commercial. Try a different URL.'
                  : screen === 'generationError'
                    ? 'An error occurred during script generation. Please try regenerating the commercial.'
                    : 'Website inaccessible or structure changed. Please check the URL or try again. Some websites block requests from a browser, which can prevent content analysis.'}
              </p>
              <p className={`mt-3 break-all text-xs ${muted}`}>{url}</p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <button onClick={(event) => generate(event, url)} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700">Retry</button>
                <button onClick={() => { setScreen('home'); setInputError(''); }} className={`${dark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'} rounded-xl border px-5 py-3 text-sm font-semibold transition`}>Try another URL</button>
              </div>
            </section>
          </main>
        )}

        {screen === 'results' && project && activePackage && (
          <main className="mx-auto max-w-5xl pt-8 sm:pt-12">
            <button onClick={() => { setScreen('home'); setProject(null); setScriptEditing(false); }} className={`mb-6 inline-flex items-center gap-2 text-sm font-semibold ${muted} transition hover:text-violet-600`}><span>←</span> All projects</button>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Analysis {project.status || 'Success'}</span>
                  {isSaved && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Saved project</span>}
                </div>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{companyNameFromUrl(project.sourceUrl)} commercials</h1>
                <a href={project.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block max-w-full break-all text-sm text-violet-600 hover:underline">{project.sourceUrl}</a>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={saveProject} className={`${isSaved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700'} rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition`}>{isSaved ? '✓ Saved' : 'Save project'}</button>
                <button onClick={exportProject} className={`${dark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-white'} rounded-xl border px-4 py-2.5 text-sm font-semibold transition`}>Export JSON</button>
                <button onClick={shareProject} className={`${dark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-white'} rounded-xl border px-4 py-2.5 text-sm font-semibold transition`}>Share link</button>
              </div>
            </div>

            {shareUrl && (
              <div className={`${card} mt-5 p-4`}>
                <label htmlFor="share-url" className="mb-2 block text-xs font-semibold">Shareable project link</label>
                <input id="share-url" readOnly value={shareUrl} onFocus={(event) => event.target.select()} className={inputClass} />
                <p className={`mt-2 text-xs ${muted}`}>Anyone with this link can open the project data encoded in it.</p>
              </div>
            )}

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <section className="min-w-0">
                <div className={`${card} p-5 sm:p-7`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Commercial script</p>
                      <h2 className="mt-2 text-2xl font-bold">{activeDuration} spot</h2>
                    </div>
                    <div className={`inline-flex rounded-xl p-1 ${dark ? 'bg-slate-800' : 'bg-slate-100'}`} aria-label="Select commercial duration">
                      {DURATIONS.map((duration) => (
                        <button key={duration} onClick={() => { setActiveDuration(duration); if (scriptEditing) { setDraftScript(project.packages.find((item) => item.duration === duration)?.script || ''); setScriptError(''); } }} className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${activeDuration === duration ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-700 dark:text-violet-200' : muted}`} aria-pressed={activeDuration === duration}>{duration}</button>
                      ))}
                    </div>
                  </div>
                  <div className={`mt-6 rounded-xl p-5 ${dark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-sm text-violet-700 dark:bg-violet-950 dark:text-violet-300">◖</span>
                      <span className="text-xs font-bold uppercase tracking-wider">Voiceover script</span>
                    </div>
                    {scriptEditing ? (
                      <div>
                        <label htmlFor="script-editor" className="mb-2 block text-sm font-semibold">Edit this commercial script</label>
                        <textarea
                          id="script-editor"
                          value={draftScript}
                          onChange={(event) => { setDraftScript(event.target.value); setScriptError(''); }}
                          className={`${inputClass} min-h-[10rem] resize-y leading-7`}
                          aria-invalid={Boolean(scriptError)}
                          aria-describedby={scriptError ? 'script-error' : undefined}
                        />
                        {scriptError && <p id="script-error" className="mt-2 text-sm text-red-600" role="alert">{scriptError}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={saveScriptEdit} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700">Save changes</button>
                          <button onClick={() => { setScriptEditing(false); setDraftScript(''); setScriptError(''); }} className={`${dark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-white'} rounded-lg border px-4 py-2 text-sm font-semibold transition`}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-sm leading-7 sm:text-base sm:leading-8">{activePackage.script}</p>
                        <button onClick={() => { setDraftScript(activePackage.script); setScriptError(''); setScriptEditing(true); }} className="mt-4 rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:border-violet-400 dark:border-violet-800 dark:bg-slate-900 dark:text-violet-200">Edit script</button>
                      </>
                    )}
                  </div>
                  <div className="mt-5 flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">Suggested end CTA</p>
                      <p className="mt-1 font-semibold">{activePackage.cta}</p>
                    </div>
                    <button onClick={() => setDetailsOpen(true)} className="rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:border-violet-400 dark:border-violet-800 dark:bg-slate-900 dark:text-violet-200">View visual breakdown</button>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-xs ${muted}`}>Drafted {shortDate(activePackage.generationDate)}</p>
                    <button onClick={() => setDetailsOpen(true)} className="text-sm font-semibold text-violet-600 hover:underline">View timed scenes →</button>
                  </div>
                </div>
              </section>

              <aside className="space-y-5">
                <section className={`${card} p-5`}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold">Website findings</h2>
                    <span className={`text-xs ${muted}`}>{project.extractedContent?.mediaAssets?.length || 0} assets</span>
                  </div>
                  <div className="mt-4 space-y-4">
                    <Finding label="Brand headline" value={project.extractedContent?.headlines?.[0]} muted={muted} />
                    <Finding label="Mission / description" value={project.extractedContent?.missionStatement} muted={muted} />
                    <Finding label="Detected CTA" value={project.extractedContent?.ctas?.[0]} muted={muted} />
                  </div>
                  <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Product & service copy</h3>
                    {project.extractedContent?.productDescriptions?.length ? (
                      <ul className="mt-3 space-y-3">
                        {project.extractedContent.productDescriptions.slice(0, 3).map((item, index) => <li key={`${item.name}-${index}`}><p className="text-sm font-semibold">{item.name}</p><p className={`mt-1 line-clamp-3 text-xs leading-5 ${muted}`}>{item.description}</p></li>)}
                      </ul>
                    ) : <p className={`mt-3 text-sm ${muted}`}>No product descriptions were detected.</p>}
                  </div>
                  <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Media links</h3>
                    {project.extractedContent?.mediaAssets?.length ? (
                      <ul className="mt-3 space-y-2">
                        {project.extractedContent.mediaAssets.slice(0, 4).map((asset) => (
                          <li key={asset.url} className="flex items-center gap-2 text-xs">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{asset.type}</span>
                            <a href={asset.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-violet-600 hover:underline">{asset.url}</a>
                          </li>
                        ))}
                      </ul>
                    ) : <p className={`mt-3 text-sm ${muted}`}>No public media links were found.</p>}
                  </div>
                </section>
              </aside>
            </div>
          </main>
        )}
      </div>

      {detailsOpen && activePackage && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="details-title" className={`${dark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl sm:p-7`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Scene-by-scene</p>
                <h2 id="details-title" className="mt-1 text-2xl font-bold">{activeDuration} visual breakdown</h2>
                <p className={`mt-1 text-sm ${muted}`}>Timed beats, voiceover, and suggested imagery.</p>
              </div>
              <button onClick={() => setDetailsOpen(false)} className={`${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'} flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg`} aria-label="Close breakdown">×</button>
            </div>
            <div className="mt-6 space-y-3">
              {activePackage.beats.map((beat, index) => (
                <article key={`${beat.time}-${index}`} className={`${dark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'} rounded-xl border p-4`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-200">{beat.time}</span>
                    <h3 className="text-sm font-bold">{beat.label}</h3>
                  </div>
                  <p className={`mt-3 text-sm leading-6 ${muted}`}><span className="font-semibold">Voiceover: </span>{beat.voiceover}</p>
                  <p className="mt-2 text-sm leading-6"><span className="font-semibold">Visual cue: </span>{beat.visual}</p>
                  {activePackage.visualCues[index]?.suggestedAssetId !== 'brand-shot' && <a href={activePackage.visualCues[index].suggestedAssetId} target="_blank" rel="noreferrer" className="mt-2 inline-block max-w-full truncate text-xs text-violet-600 hover:underline">Suggested source asset ↗</a>}
                </article>
              ))}
            </div>
            <button onClick={() => setDetailsOpen(false)} className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700">Done</button>
          </section>
        </div>
      )}

      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

function ProjectRow({ saved, dark, muted, onOpen, onDelete }) {
  return (
    <article className={`${dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between`}>
      <button onClick={onOpen} className="min-w-0 text-left">
        <span className="block truncate font-semibold">{companyNameFromUrl(saved.sourceUrl)} commercials</span>
        <span className={`mt-1 block truncate text-xs ${muted}`}>{saved.sourceUrl} · {shortDate(saved.createdAt)}</span>
        <span className={`mt-2 block text-xs ${muted}`}>5s · 10s · 15s · 30s · 60s scripts</span>
      </button>
      <div className="flex shrink-0 gap-2">
        <button onClick={onOpen} className="rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-violet-700">Open</button>
        <button onClick={onDelete} className={`${dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'} rounded-lg border px-3 py-2 text-xs font-semibold transition`} aria-label={`Delete ${companyNameFromUrl(saved.sourceUrl)} project`}>Delete</button>
      </div>
    </article>
  );
}

function Finding({ label, value, muted }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</h3>
      {value ? <p className="mt-1 line-clamp-3 text-sm leading-6">{value}</p> : <p className={`mt-1 text-sm ${muted}`}>Nothing detected on this page.</p>}
    </div>
  );
}

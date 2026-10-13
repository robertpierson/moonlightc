"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface Stats {
  login: string;
  name?: string;
  avatar: string;
  repos: number;
  followers: number;
  contributions?: number;
  openPRs: number;
  reviewRequests: number;
  assignedIssues: number;
  recent: { name: string; url: string; pushed: string; stars: number; language?: string }[];
}

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", ...init?.headers } });
  if (res.status === 401) throw new Error("GitHub rejected the token. Remove the GitHub connector and add a fresh token.");
  if (!res.ok) throw new Error(`GitHub returned ${res.status}.`);
  return res.json() as Promise<T>;
}

async function load(token: string): Promise<Stats> {
  const user = await gh<{ login: string; name?: string; avatar_url: string; public_repos: number; owned_private_repos?: number; followers: number }>(token, "/user");
  const count = (q: string) => gh<{ total_count: number }>(token, `/search/issues?per_page=1&q=${encodeURIComponent(q)}`).then((r) => r.total_count);
  const [openPRs, reviewRequests, assignedIssues, recent, contributions] = await Promise.all([
    count(`is:pr is:open author:${user.login}`),
    count(`is:pr is:open review-requested:${user.login}`),
    count(`is:issue is:open assignee:${user.login}`),
    gh<{ full_name: string; html_url: string; pushed_at: string; stargazers_count: number; language?: string }[]>(token, "/user/repos?sort=pushed&per_page=6"),
    gh<{ data?: { viewer: { contributionsCollection: { contributionCalendar: { totalContributions: number } } } } }>(token, "/graphql", {
      method: "POST",
      body: JSON.stringify({ query: "{ viewer { contributionsCollection { contributionCalendar { totalContributions } } } }" }),
    })
      .then((r) => r.data?.viewer.contributionsCollection.contributionCalendar.totalContributions)
      .catch(() => undefined),
  ]);
  return {
    login: user.login,
    name: user.name,
    avatar: user.avatar_url,
    repos: user.public_repos + (user.owned_private_repos ?? 0),
    followers: user.followers,
    contributions,
    openPRs,
    reviewRequests,
    assignedIssues,
    recent: recent.map((r) => ({ name: r.full_name, url: r.html_url, pushed: r.pushed_at, stars: r.stargazers_count, language: r.language })),
  };
}

/** Live numbers straight from GitHub's API with the user's token. Nothing is stored. */
export function GitHubDashboard({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats>();
  const [error, setError] = useState("");
  useEffect(() => {
    load(token).then(setStats, (e: Error) => setError(e.message));
  }, [token]);

  if (error) return <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>;
  if (!stats)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading your GitHub numbers…
      </p>
    );

  const tiles: [string, number | undefined][] = [
    ["Open pull requests", stats.openPRs],
    ["Reviews requested from you", stats.reviewRequests],
    ["Issues assigned to you", stats.assignedIssues],
    ["Repositories", stats.repos],
    ["Contributions this year", stats.contributions],
    ["Followers", stats.followers],
  ];
  return (
    <section aria-label="GitHub" className="grid gap-4 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stats.avatar} alt="" className="size-10 rounded-full" />
        <div>
          <div className="font-semibold">{stats.name ?? stats.login}</div>
          <a href={`https://github.com/${stats.login}`} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:underline">
            @{stats.login}
          </a>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles
          .filter(([, v]) => v !== undefined)
          .map(([label, v]) => (
            <div key={label} className="rounded-lg bg-muted p-3">
              <dd className="text-2xl font-semibold tabular-nums">{v!.toLocaleString()}</dd>
              <dt className="text-xs text-muted-foreground">{label}</dt>
            </div>
          ))}
      </dl>
      <div>
        <h3 className="mb-2 text-sm font-medium">Recently pushed</h3>
        <ul className="grid gap-1 text-sm">
          {stats.recent.map((r) => (
            <li key={r.name} className="flex gap-2">
              <a href={r.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                {r.name}
              </a>
              <span className="text-muted-foreground">{r.language}</span>
              <span className="text-muted-foreground tabular-nums">★ {r.stars}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

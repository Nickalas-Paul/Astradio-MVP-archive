export type Mode = "clusters" | "elemental" | "lunar";

export class AstradioClient {
  constructor(private base = "/v1") {}
  private access: string | null = null;

  setToken(t: string) { this.access = t; }
  private h(extra: Record<string,string> = {}) {
    return {
      "content-type": "application/json",
      ...(this.access ? { authorization: `Bearer ${this.access}` } : {}),
      ...extra
    };
  }
  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const r = await fetch(`${this.base}${path}`, init);
    if (r.status === 401 && path !== "/auth/refresh") {
      // try refresh
      const rr = await fetch(`${this.base}/auth/refresh`, { method: "POST", credentials: "include" });
      if (rr.ok) {
        const { access_token } = await rr.json();
        this.access = access_token;
        return this.req<T>(path, init);
      }
    }
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();
  }

  // Auth
  register(email: string, password: string) {
    return this.req<unknown>("/auth/register", { method: "POST", headers: this.h(), body: JSON.stringify({ email, password }) });
  }
  async login(email: string, password: string) {
    const res = await this.req<{ access_token: string; expires_in: number }>("/auth/login", {
      method: "POST", headers: this.h(), body: JSON.stringify({ email, password })
    });
    this.setToken(res.access_token);
    return res;
  }
  logout() {
    this.access = null;
    return this.req<unknown>("/auth/logout", { method: "POST", headers: this.h() });
  }

  // Users
  me() { return this.req<any>("/users/me", { headers: this.h() }); }
  updateMe(patch: Record<string, unknown>) {
    return this.req<any>("/users/me", { method: "PATCH", headers: this.h(), body: JSON.stringify(patch) });
  }
  updateProfile(patch: Record<string, unknown>) {
    return this.req<any>("/users/me/profile", { method: "PATCH", headers: this.h(), body: JSON.stringify(patch) });
  }
  getUser(username: string) { return this.req<any>(`/users/${encodeURIComponent(username)}`, { headers: this.h() }); }

  // Tracks
  renderTrack(chartData: unknown, mode: Mode, genre: string) {
    return this.req<any>("/tracks/render", { method: "POST", headers: this.h(), body: JSON.stringify({ chartData, mode, genre }) });
  }
  getTrack(id: string) { return this.req<any>(`/tracks/${id}`, { headers: this.h() }); }
  saveTrack(id: string) { return this.req<any>(`/tracks/${id}/save`, { method: "POST", headers: this.h() }); }
  unsaveTrack(id: string) { return this.req<any>(`/tracks/${id}/save`, { method: "DELETE", headers: this.h() }); }
  likeTrack(id: string) { return this.req<any>(`/tracks/${id}/like`, { method: "POST", headers: this.h() }); }
  unlikeTrack(id: string) { return this.req<any>(`/tracks/${id}/like`, { method: "DELETE", headers: this.h() }); }
  shareCard(id: string) { return this.req<any>(`/tracks/${id}/share-card`, { headers: this.h() }); }

  // Social
  follow(username: string) { return this.req<any>(`/follows/${encodeURIComponent(username)}`, { method: "POST", headers: this.h() }); }
  unfollow(username: string) { return this.req<any>(`/follows/${encodeURIComponent(username)}`, { method: "DELETE", headers: this.h() }); }
  compare(username: string, myChart?: unknown) {
    return this.req<any>(`/compare/${encodeURIComponent(username)}`, { method: "POST", headers: this.h(), body: JSON.stringify(myChart || {}) });
  }
}

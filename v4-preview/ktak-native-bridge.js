//#region \0rolldown/runtime.js
var e = Object.defineProperty, t = (e, t, n) => () => {
	if (n) throw n[0];
	try {
		return e && (t = e(e = 0)), t;
	} catch (e) {
		throw n = [e], e;
	}
}, n = (t, n) => {
	let r = {};
	for (var i in t) e(r, i, {
		get: t[i],
		enumerable: !0
	});
	return n || e(r, Symbol.toStringTag, { value: "Module" }), r;
}, r, i, a, o, s, c, l, u, d, f, p, m, h, g, _, v, y, b, x, S = t((() => {
	(function(e) {
		e.Unimplemented = "UNIMPLEMENTED", e.Unavailable = "UNAVAILABLE";
	})(r ||= {}), i = class extends Error {
		constructor(e, t, n) {
			super(e), this.message = e, this.code = t, this.data = n;
		}
	}, a = (e) => e?.androidBridge ? "android" : e?.webkit?.messageHandlers?.bridge ? "ios" : "web", o = (e) => {
		let t = e.CapacitorCustomPlatform || null, n = e.Capacitor || {}, o = n.Plugins = n.Plugins || {}, s = () => t === null ? a(e) : t.name, c = () => s() !== "web", l = (e) => !!(f.get(e)?.platforms.has(s()) || u(e)), u = (e) => n.PluginHeaders?.find((t) => t.name === e), d = (t) => e.console.error(t), f = /* @__PURE__ */ new Map();
		return n.convertFileSrc ||= (e) => e, n.getPlatform = s, n.handleError = d, n.isNativePlatform = c, n.isPluginAvailable = l, n.registerPlugin = (e, a = {}) => {
			let c = f.get(e);
			if (c) return console.warn(`Capacitor plugin "${e}" already registered. Cannot register plugins twice.`), c.proxy;
			let l = s(), d = u(e), p, m = async () => (!p && l in a ? p = p = typeof a[l] == "function" ? await a[l]() : a[l] : t !== null && !p && "web" in a && (p = p = typeof a.web == "function" ? await a.web() : a.web), p), h = (t, a) => {
				if (d) {
					let r = d?.methods.find((e) => a === e.name);
					if (r) return r.rtype === "promise" ? (t) => n.nativePromise(e, a.toString(), t) : (t, r) => n.nativeCallback(e, a.toString(), t, r);
					if (t) return t[a]?.bind(t);
				} else if (t) return t[a]?.bind(t);
				else throw new i(`"${e}" plugin is not implemented on ${l}`, r.Unimplemented);
			}, g = (t) => {
				let n, a = (...a) => {
					let o = m().then((o) => {
						let s = h(o, t);
						if (s) {
							let e = s(...a);
							return n = e?.remove, e;
						}
						throw new i(`"${e}.${t}()" is not implemented on ${l}`, r.Unimplemented);
					});
					return t === "addListener" && (o.remove = async () => n()), o;
				};
				return a.toString = () => `${t.toString()}() { [capacitor code] }`, Object.defineProperty(a, "name", {
					value: t,
					writable: !1,
					configurable: !1
				}), a;
			}, _ = g("addListener"), v = g("removeListener"), y = (e, t) => {
				let n = _({ eventName: e }, t), r = async () => {
					let r = await n;
					v({
						eventName: e,
						callbackId: r
					}, t);
				}, i = new Promise((e) => n.then(() => e({ remove: r })));
				return i.remove = async () => {
					console.warn("Using addListener() without 'await' is deprecated."), await r();
				}, i;
			}, b = new Proxy({}, { get(e, t) {
				switch (t) {
					case "$$typeof": return;
					case "toJSON": return () => ({});
					case "addListener": return d ? y : _;
					case "removeListener": return v;
					default: return g(t);
				}
			} });
			return o[e] = b, f.set(e, {
				name: e,
				proxy: b,
				platforms: /* @__PURE__ */ new Set([...Object.keys(a), ...d ? [l] : []])
			}), b;
		}, n.Exception = i, n.DEBUG = !!n.DEBUG, n.isLoggingEnabled = !!n.isLoggingEnabled, n;
	}, s = (e) => e.Capacitor = o(e), c = /*#__PURE__*/ s(typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {}), l = c.registerPlugin, u = class {
		constructor() {
			this.listeners = {}, this.retainedEventArguments = {}, this.windowListeners = {};
		}
		addListener(e, t) {
			let n = !1;
			this.listeners[e] || (this.listeners[e] = [], n = !0), this.listeners[e].push(t);
			let r = this.windowListeners[e];
			return r && !r.registered && this.addWindowListener(r), n && this.sendRetainedArgumentsForEvent(e), Promise.resolve({ remove: async () => this.removeListener(e, t) });
		}
		async removeAllListeners() {
			this.listeners = {};
			for (let e in this.windowListeners) this.removeWindowListener(this.windowListeners[e]);
			this.windowListeners = {};
		}
		notifyListeners(e, t, n) {
			let r = this.listeners[e];
			if (!r) {
				if (n) {
					let n = this.retainedEventArguments[e];
					n ||= [], n.push(t), this.retainedEventArguments[e] = n;
				}
				return;
			}
			r.forEach((e) => e(t));
		}
		hasListeners(e) {
			return !!this.listeners[e]?.length;
		}
		registerWindowListener(e, t) {
			this.windowListeners[t] = {
				registered: !1,
				windowEventName: e,
				pluginEventName: t,
				handler: (e) => {
					this.notifyListeners(t, e);
				}
			};
		}
		unimplemented(e = "not implemented") {
			return new c.Exception(e, r.Unimplemented);
		}
		unavailable(e = "not available") {
			return new c.Exception(e, r.Unavailable);
		}
		async removeListener(e, t) {
			let n = this.listeners[e];
			if (!n) return;
			let r = n.indexOf(t);
			this.listeners[e].splice(r, 1), this.listeners[e].length || this.removeWindowListener(this.windowListeners[e]);
		}
		addWindowListener(e) {
			window.addEventListener(e.windowEventName, e.handler), e.registered = !0;
		}
		removeWindowListener(e) {
			e && (window.removeEventListener(e.windowEventName, e.handler), e.registered = !1);
		}
		sendRetainedArgumentsForEvent(e) {
			let t = this.retainedEventArguments[e];
			t && (delete this.retainedEventArguments[e], t.forEach((t) => {
				this.notifyListeners(e, t);
			}));
		}
	}, d = (e) => encodeURIComponent(e).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape), f = (e) => e.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent), p = class extends u {
		async getCookies() {
			let e = document.cookie, t = {};
			return e.split(";").forEach((e) => {
				if (e.length <= 0) return;
				let [n, r] = e.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
				n = f(n).trim(), r = f(r).trim(), t[n] = r;
			}), t;
		}
		async setCookie(e) {
			try {
				let t = d(e.key), n = d(e.value), r = e.expires ? `; expires=${e.expires.replace("expires=", "")}` : "", i = (e.path || "/").replace("path=", ""), a = e.url != null && e.url.length > 0 ? `domain=${e.url}` : "";
				document.cookie = `${t}=${n || ""}${r}; path=${i}; ${a};`;
			} catch (e) {
				return Promise.reject(e);
			}
		}
		async deleteCookie(e) {
			try {
				document.cookie = `${e.key}=; Max-Age=0`;
			} catch (e) {
				return Promise.reject(e);
			}
		}
		async clearCookies() {
			try {
				let e = document.cookie.split(";") || [];
				for (let t of e) document.cookie = t.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
			} catch (e) {
				return Promise.reject(e);
			}
		}
		async clearAllCookies() {
			try {
				await this.clearCookies();
			} catch (e) {
				return Promise.reject(e);
			}
		}
	}, l("CapacitorCookies", { web: () => new p() }), m = async (e) => new Promise((t, n) => {
		let r = new FileReader();
		r.onload = () => {
			let e = r.result;
			t(e.indexOf(",") >= 0 ? e.split(",")[1] : e);
		}, r.onerror = (e) => n(e), r.readAsDataURL(e);
	}), h = (e = {}) => {
		let t = Object.keys(e);
		return Object.keys(e).map((e) => e.toLocaleLowerCase()).reduce((n, r, i) => (n[r] = e[t[i]], n), {});
	}, g = (e, t = !0) => e ? Object.entries(e).reduce((e, n) => {
		let [r, i] = n, a, o;
		return Array.isArray(i) ? (o = "", i.forEach((e) => {
			a = t ? encodeURIComponent(e) : e, o += `${r}=${a}&`;
		}), o.slice(0, -1)) : (a = t ? encodeURIComponent(i) : i, o = `${r}=${a}`), `${e}&${o}`;
	}, "").substr(1) : null, _ = (e, t = {}) => {
		let n = Object.assign({
			method: e.method || "GET",
			headers: e.headers
		}, t), r = h(e.headers)["content-type"] || "";
		if (typeof e.data == "string") n.body = e.data;
		else if (r.includes("application/x-www-form-urlencoded")) {
			let t = new URLSearchParams();
			for (let [n, r] of Object.entries(e.data || {})) t.set(n, r);
			n.body = t.toString();
		} else if (r.includes("multipart/form-data") || e.data instanceof FormData) {
			let t = new FormData();
			if (e.data instanceof FormData) e.data.forEach((e, n) => {
				t.append(n, e);
			});
			else for (let n of Object.keys(e.data)) t.append(n, e.data[n]);
			n.body = t;
			let r = new Headers(n.headers);
			r.delete("content-type"), n.headers = r;
		} else (r.includes("application/json") || typeof e.data == "object") && (n.body = JSON.stringify(e.data));
		return n;
	}, v = class extends u {
		async request(e) {
			let t = _(e, e.webFetchExtra), n = g(e.params, e.shouldEncodeUrlParams), r = n ? `${e.url}?${n}` : e.url, i = await fetch(r, t), a = i.headers.get("content-type") || "", { responseType: o = "text" } = i.ok ? e : {};
			a.includes("application/json") && (o = "json");
			let s, c;
			switch (o) {
				case "arraybuffer":
				case "blob":
					c = await i.blob(), s = await m(c);
					break;
				case "json":
					s = await i.json();
					break;
				default: s = await i.text();
			}
			let l = {};
			return i.headers.forEach((e, t) => {
				l[t] = e;
			}), {
				data: s,
				headers: l,
				status: i.status,
				url: i.url
			};
		}
		async get(e) {
			return this.request(Object.assign(Object.assign({}, e), { method: "GET" }));
		}
		async post(e) {
			return this.request(Object.assign(Object.assign({}, e), { method: "POST" }));
		}
		async put(e) {
			return this.request(Object.assign(Object.assign({}, e), { method: "PUT" }));
		}
		async patch(e) {
			return this.request(Object.assign(Object.assign({}, e), { method: "PATCH" }));
		}
		async delete(e) {
			return this.request(Object.assign(Object.assign({}, e), { method: "DELETE" }));
		}
	}, l("CapacitorHttp", { web: () => new v() }), (function(e) {
		e.Dark = "DARK", e.Light = "LIGHT", e.Default = "DEFAULT";
	})(y ||= {}), (function(e) {
		e.StatusBar = "StatusBar", e.NavigationBar = "NavigationBar";
	})(b ||= {}), x = class extends u {
		async setStyle() {
			this.unavailable("not available for web");
		}
		async setAnimation() {
			this.unavailable("not available for web");
		}
		async show() {
			this.unavailable("not available for web");
		}
		async hide() {
			this.unavailable("not available for web");
		}
	}, l("SystemBars", { web: () => new x() });
})), C = /* @__PURE__ */ n({ BackgroundGeolocationWeb: () => w }), w, T = t((() => {
	S(), w = class e extends u {
		constructor() {
			super(...arguments), this.plannedRoute = [], this.isOffRoute = !0, this.distanceThreshold = 50, this.geofences = /* @__PURE__ */ new Map(), this.geofenceHeaders = {}, this.geofencePayload = {}, this.notifyOnEntry = !0, this.notifyOnExit = !0;
		}
		async start(e, t) {
			if (!navigator.geolocation) {
				t(void 0, {
					name: "GeolocationError",
					message: "Geolocation is not supported by this browser",
					code: "NOT_SUPPORTED"
				});
				return;
			}
			if (this.watchId) {
				t(void 0, {
					name: "GeolocationError",
					message: "Geolocation already started",
					code: "ALREADY_STARTED"
				});
				return;
			}
			this.watchId = navigator.geolocation.watchPosition((e) => {
				let n = {
					latitude: e.coords.latitude,
					longitude: e.coords.longitude,
					accuracy: e.coords.accuracy,
					altitude: e.coords.altitude,
					altitudeAccuracy: e.coords.altitudeAccuracy,
					simulated: !1,
					bearing: e.coords.heading,
					speed: e.coords.speed,
					time: e.timestamp
				};
				if (this.audio && this.plannedRoute.length > 0) {
					let t = [e.coords.longitude, e.coords.latitude], n = this.distancePointToRoute(t) > this.distanceThreshold;
					n == 1 && this.isOffRoute === !1 && this.audio.play(), this.isOffRoute = n;
				}
				this.checkGeofences(e.coords.latitude, e.coords.longitude), t(n);
			}, (e) => {
				t(void 0, {
					name: "GeolocationError",
					message: e.message,
					code: e.code.toString()
				});
			}, {
				enableHighAccuracy: !0,
				timeout: 1e4,
				maximumAge: e.stale ? 3e5 : 0
			});
		}
		async stop() {
			this.watchId && (navigator.geolocation.clearWatch(this.watchId), delete this.watchId);
		}
		async openSettings() {
			console.log("openSettings: Web implementation cannot open native settings"), window.alert("Please enable location permissions in your browser settings");
		}
		async setPlannedRoute(e) {
			if (!e.soundFile) throw Error("Sound file is required");
			this.audio &&= (this.audio.pause(), this.audio.src = "", void 0), this.audio = new Audio(e.soundFile), this.plannedRoute = e.route || [], this.distanceThreshold = e.distance || 50;
		}
		async setupGeofencing(e) {
			e.url && new URL(e.url), this.geofenceUrl = e.url, this.geofenceHeaders = Object.assign({}, e.headers ?? {}), this.notifyOnEntry = e.notifyOnEntry ?? !0, this.notifyOnExit = e.notifyOnExit ?? !0, this.geofencePayload = e.payload ?? {};
		}
		async updateHeaders(e) {
			this.geofenceHeaders = Object.assign({}, e.headers ?? {});
		}
		async addGeofence(e) {
			if (!navigator.geolocation) throw Error("Geolocation is not supported by this browser");
			this.validateGeofence(e.latitude, e.longitude, e.radius ?? 50, e.identifier), this.geofences.set(e.identifier, {
				latitude: e.latitude,
				longitude: e.longitude,
				radius: e.radius ?? 50,
				identifier: e.identifier,
				notifyOnEntry: e.notifyOnEntry ?? this.notifyOnEntry,
				notifyOnExit: e.notifyOnExit ?? this.notifyOnExit,
				payload: e.payload
			}), this.startGeofenceWatch();
		}
		async removeGeofence(e) {
			if (!e.identifier) throw Error("Identifier is required");
			this.geofences.delete(e.identifier), this.stopGeofenceWatchIfIdle();
		}
		async removeAllGeofences() {
			this.geofences.clear(), this.stopGeofenceWatchIfIdle();
		}
		async getMonitoredGeofences() {
			return { regions: Array.from(this.geofences.keys()) };
		}
		async checkPermissions() {
			if (!navigator.permissions) return {
				location: "prompt",
				backgroundLocation: "prompt",
				notification: "granted"
			};
			try {
				let e = await navigator.permissions.query({ name: "geolocation" }), t = e.state === "granted" ? "granted" : e.state === "denied" ? "denied" : "prompt";
				return {
					location: t,
					backgroundLocation: t,
					notification: "granted"
				};
			} catch {
				return {
					location: "prompt",
					backgroundLocation: "prompt",
					notification: "granted"
				};
			}
		}
		async requestPermissions() {
			return this.checkPermissions();
		}
		validateGeofence(e, t, n, r) {
			if (!r) throw Error("Identifier is required");
			if (!Number.isFinite(e) || e < -90 || e > 90) throw Error("Latitude must be between -90 and 90");
			if (!Number.isFinite(t) || t < -180 || t > 180) throw Error("Longitude must be between -180 and 180");
			if (!Number.isFinite(n) || n <= 0) throw Error("Radius must be greater than 0");
		}
		startGeofenceWatch() {
			this.geofenceWatchId !== void 0 || this.geofences.size === 0 || !navigator.geolocation || (this.geofenceWatchId = navigator.geolocation.watchPosition((e) => this.checkGeofences(e.coords.latitude, e.coords.longitude), () => void 0, {
				enableHighAccuracy: !1,
				timeout: 3e4,
				maximumAge: 6e4
			}));
		}
		stopGeofenceWatchIfIdle() {
			this.geofences.size > 0 || this.geofenceWatchId === void 0 || (navigator.geolocation.clearWatch(this.geofenceWatchId), this.geofenceWatchId = void 0);
		}
		checkGeofences(e, t) {
			let n = [t, e];
			this.geofences.forEach((e) => {
				let t = this.haversine(n, [e.longitude, e.latitude]) <= e.radius, r = e.inside;
				e.inside = t, t && r !== !0 && e.notifyOnEntry ? this.emitGeofenceTransition(e, !0) : !t && r === !0 && e.notifyOnExit && this.emitGeofenceTransition(e, !1);
			});
		}
		emitGeofenceTransition(e, t) {
			let n = Object.assign(Object.assign({}, this.geofencePayload), e.payload ?? {}), r = Object.assign(Object.assign({}, n), {
				identifier: e.identifier,
				transition: t ? "enter" : "exit",
				enter: t,
				latitude: e.latitude,
				longitude: e.longitude,
				radius: e.radius,
				payload: n
			});
			this.notifyListeners("geofenceTransition", r), this.geofenceUrl && fetch(this.geofenceUrl, {
				method: "POST",
				headers: Object.assign({
					Accept: "application/json",
					"Content-Type": "application/json"
				}, this.geofenceHeaders),
				body: JSON.stringify(r)
			}).catch(() => void 0);
		}
		toRadians(e) {
			return e * Math.PI / 180;
		}
		haversine(t, n) {
			let [r, i] = t, [a, o] = n, s = this.toRadians(o - i), c = this.toRadians(a - r), l = Math.sin(s / 2) * Math.sin(s / 2) + Math.cos(this.toRadians(i)) * Math.cos(this.toRadians(o)) * Math.sin(c / 2) * Math.sin(c / 2), u = 2 * Math.atan2(Math.sqrt(l), Math.sqrt(1 - l));
			return e.EARTH_RADIUS_M * u;
		}
		distancePointToLineSegment(e, t, n) {
			let r = this.haversine(e, t), i = this.haversine(e, n), a = this.haversine(t, n);
			if (a === 0 || (r ** 2 + a ** 2 - i ** 2) / (2 * r * a + 2 ** -52) < 0) return r;
			if ((i ** 2 + a ** 2 - r ** 2) / (2 * i * a + 2 ** -52) < 0) return i;
			let o = (r + i + a) / 2;
			return 2 * Math.sqrt(Math.max(0, o * (o - r) * (o - i) * (o - a))) / (a + 2 ** -52);
		}
		distancePointToRoute(e) {
			if (this.plannedRoute.length < 2) return this.plannedRoute.length === 1 ? this.haversine(e, this.plannedRoute[0]) : Infinity;
			let t = Infinity;
			for (let n = 0; n < this.plannedRoute.length - 1; n++) {
				let r = this.plannedRoute[n], i = this.plannedRoute[n + 1], a = this.distancePointToLineSegment(e, r, i);
				a < t && (t = a);
			}
			return t;
		}
		async getPluginVersion() {
			return { version: "web" };
		}
	}, w.EARTH_RADIUS_M = 6371e3;
}));
//#endregion
//#region node_modules/@capgo/background-geolocation/dist/esm/index.js
S();
var E = l("BackgroundGeolocation", { web: () => Promise.resolve().then(() => (T(), C)).then((e) => new e.BackgroundGeolocationWeb()) });
//#endregion
//#region src/full-ui-native-bridge.js
S();
var D = !1;
function O(e) {
	return e ? {
		latitude: Number(e.latitude),
		longitude: Number(e.longitude),
		accuracy: e.accuracy == null ? null : Number(e.accuracy),
		altitude: e.altitude == null ? null : Number(e.altitude),
		altitudeAccuracy: e.altitudeAccuracy == null ? null : Number(e.altitudeAccuracy),
		speed: e.speed == null ? null : Number(e.speed),
		bearing: e.bearing == null ? null : Number(e.bearing),
		time: e.time ?? Date.now(),
		simulated: !!e.simulated
	} : null;
}
window.KTAK_NATIVE_BRIDGE = {
	isNative() {
		return c.isNativePlatform();
	},
	platform() {
		return c.getPlatform();
	},
	async permissions() {
		return c.isNativePlatform() ? E.checkPermissions() : {
			location: "unavailable",
			backgroundLocation: "unavailable",
			notification: "unavailable"
		};
	},
	async openLocationSettings() {
		return c.isNativePlatform() ? (await E.openSettings(), !0) : !1;
	},
	async startBackgroundLocation({ url: e, headers: t, minIntervalMs: n = 5e3 } = {}, r) {
		return c.isNativePlatform() ? D ? !0 : (await E.start({
			backgroundTitle: "KTAK 任務定位中",
			backgroundMessage: "正在共享你的即時位置",
			requestPermissions: !0,
			stale: !1,
			distanceFilter: 0,
			minIntervalMs: n,
			url: e,
			headers: t
		}, (e, t) => {
			if (t) {
				r?.(null, {
					code: t.code ?? "NATIVE_LOCATION_ERROR",
					message: t.message ?? String(t)
				});
				return;
			}
			let n = O(e);
			!n || !Number.isFinite(n.latitude) || !Number.isFinite(n.longitude) || r?.(n, null);
		}), D = !0, !0) : !1;
	},
	async stopBackgroundLocation() {
		if (!c.isNativePlatform()) return !1;
		try {
			await E.stop();
		} finally {
			D = !1;
		}
		return !0;
	},
	isRunning() {
		return D;
	}
}, window.dispatchEvent(new CustomEvent("ktak-native-bridge-ready"));
//#endregion

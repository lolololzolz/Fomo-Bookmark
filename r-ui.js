(function(root) {
    "use strict";
    const KEYS = {
        watchlist: "koltools.twitter.watchlist.v1",
        seen: "koltools.twitter.seen.v1",
        matches: "koltools.twitter.matches.v1",
        latest: "koltools.twitter.latest.v1",
        preferences: "koltools.twitter.preferences.v1"
    }
      , MAX_ACCOUNTS = 10
      , MAX_SEEN = 500
      , MAX_MATCHES = 100;
    const DEFAULT_PREFERENCES = Object.freeze({
        polling: true,
        contractsOnly: false,
        compact: false,
        largerText: false,
        showExcerpts: true,
        matchChain: "all",
        matchSort: "newest",
        matchQuery: ""
    });
    function normalizeHandle(value) {
        const handle = String(value || "").trim().replace(/^@/, "");
        return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : null
    }
    function normalizeHandles(values) {
        const out = []
          , seen = new Set();
        for (const value of Array.isArray(values) ? values : []) {
            const handle = normalizeHandle(value)
              , key = handle && handle.toLowerCase();
            if (!handle || seen.has(key))
                continue;
            seen.add(key);
            out.push(handle);
            if (out.length === MAX_ACCOUNTS)
                break
        }
        return out
    }
    function serializeWatchlist(handles) {
        return JSON.stringify(normalizeHandles(handles))
    }
    function parseWatchlist(raw) {
        try {
            const value = JSON.parse(raw || "[]");
            return Array.isArray(value) ? normalizeHandles(value) : []
        } catch {
            return []
        }
    }
    function hasHandle(accounts, handle) {
        const key = String(handle || "").toLowerCase();
        return accounts.some(account => String(account).toLowerCase() === key)
    }
    function filterNewPosts(posts, seenIds) {
        const ids = Array.isArray(seenIds) ? seenIds.map(String) : []
          , known = new Set(ids)
          , fresh = [];
        for (const post of Array.isArray(posts) ? posts : []) {
            const id = post && post.id != null ? String(post.id) : "";
            if (!id || known.has(id))
                continue;
            known.add(id);
            ids.push(id);
            fresh.push(post)
        }
        return {
            posts: fresh,
            seenIds: ids.slice(-MAX_SEEN)
        }
    }
    function parseSeenIds(raw) {
        try {
            const value = JSON.parse(raw || "[]");
            return Array.isArray(value) ? value.filter(id => typeof id === "string" || typeof id === "number").map(String).slice(-MAX_SEEN) : []
        } catch {
            return []
        }
    }
    function safeExternalUrl(value) {
        try {
            const url = new URL(value)
              , hosts = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
            return url.protocol === "https:" && hosts.has(url.hostname.toLowerCase()) && /\/status\/\d+(?:\/|$)/.test(url.pathname) ? url.href : ""
        } catch {
            return ""
        }
    }
    function parseMatches(raw) {
        try {
            const value = JSON.parse(raw || "[]");
            if (!Array.isArray(value))
                return [];
            return value.flatMap(match => {
                const handle = normalizeHandle(match?.handle);
                if (!match || typeof match.address !== "string" || typeof match.chain !== "string" || !handle)
                    return [];
                return [{
                    ...match,
                    handle,
                    address: match.address.slice(0, 256),
                    chain: match.chain.slice(0, 32),
                    text: typeof match.text === "string" ? match.text.slice(0, 10000) : "",
                    url: safeExternalUrl(match.url)
                }]
            }
            ).slice(0, MAX_MATCHES)
        } catch {
            return []
        }
    }
    function parseLatestPosts(raw) {
        try {
            const value = JSON.parse(raw || "[]");
            if (!Array.isArray(value))
                return [];
            return value.flatMap(post => {
                const handle = normalizeHandle(post?.handle)
                  , id = String(post?.id || "")
                  , url = safeExternalUrl(post?.url)
                  , date = new Date(post?.publishedAt);
                if (!handle || !/^\d+$/.test(id) || typeof post?.text !== "string" || !url || !Number.isFinite(date.getTime()))
                    return [];
                const contracts = Array.isArray(post.contracts) ? post.contracts.filter(item => item && typeof item.address === "string" && typeof item.chain === "string").slice(0, 10) : [];
                return [{
                    id,
                    handle,
                    text: post.text.slice(0, 10000),
                    url,
                    publishedAt: date.toISOString(),
                    contracts
                }]
            }
            ).slice(0, MAX_ACCOUNTS)
        } catch {
            return []
        }
    }
    function latestPostsByHandle(posts) {
        const result = {};
        for (const post of Array.isArray(posts) ? posts : []) {
            const handle = normalizeHandle(post?.handle)
              , key = handle && handle.toLowerCase()
              , time = new Date(post?.publishedAt).getTime();
            if (!key || !Number.isFinite(time))
                continue;
            const current = result[key]
              , currentTime = current ? new Date(current.publishedAt).getTime() : -Infinity;
            if (time > currentTime)
                result[key] = post
        }
        return result
    }
    function parsePreferences(raw) {
        try {
            const value = JSON.parse(raw || "{}");
            if (!value || typeof value !== "object" || Array.isArray(value))
                return {
                    ...DEFAULT_PREFERENCES
                };
            return {
                polling: typeof value.polling === "boolean" ? value.polling : true,
                contractsOnly: typeof value.contractsOnly === "boolean" ? value.contractsOnly : false,
                compact: typeof value.compact === "boolean" ? value.compact : false,
                largerText: typeof value.largerText === "boolean" ? value.largerText : false,
                showExcerpts: typeof value.showExcerpts === "boolean" ? value.showExcerpts : true,
                matchChain: ["all", "evm", "solana"].includes(value.matchChain) ? value.matchChain : "all",
                matchSort: ["newest", "account"].includes(value.matchSort) ? value.matchSort : "newest",
                matchQuery: typeof value.matchQuery === "string" ? value.matchQuery.slice(0, 100) : ""
            }
        } catch {
            return {
                ...DEFAULT_PREFERENCES
            }
        }
    }
    function groupMatchesByAccount(matches, options={}) {
        const query = String(options.query || "").trim().toLowerCase()
          , chain = String(options.chain || "all").toLowerCase()
          , sort = options.sort === "account" ? "account" : "newest"
          , groups = new Map()
          , dateValue = value => {
            const time = new Date(value).getTime();
            return Number.isFinite(time) ? time : 0
        }
        ;
        for (const match of Array.isArray(matches) ? matches : []) {
            const handle = normalizeHandle(match?.handle)
              , rawChain = String(match?.chain || "").toLowerCase()
              , matchChain = rawChain === "sol" ? "solana" : rawChain
              , searchable = `${handle || ""} ${match?.address || ""} ${match?.text || ""}`.toLowerCase();
            if (!handle || (chain !== "all" && matchChain !== chain) || (query && !searchable.includes(query)))
                continue;
            const key = handle.toLowerCase();
            if (!groups.has(key))
                groups.set(key, {
                    handle,
                    matches: []
                });
            groups.get(key).matches.push(match)
        }
        const result = [...groups.values()];
        for (const group of result) {
            group.matches.sort( (a, b) => dateValue(b.publishedAt) - dateValue(a.publishedAt));
            group.latestAt = group.matches[0]?.publishedAt || ""
        }
        result.sort(sort === "account" ? (a, b) => a.handle.localeCompare(b.handle, undefined, {
            sensitivity: "base"
        }) : (a, b) => dateValue(b.latestAt) - dateValue(a.latestAt));
        return result
    }
    function relativeTime(value) {
        const time = new Date(value).getTime();
        if (!Number.isFinite(time))
            return "Recently";
        const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
        if (seconds < 60)
            return `${seconds}s ago`;
        if (seconds < 3600)
            return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400)
            return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`
    }
    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className)
            node.className = className;
        if (text !== undefined)
            node.textContent = text;
        return node
    }
    function init() {
        const byId = id => document.getElementById(id)
          , ui = byId("ui")
          , form = byId("mock-account-form")
          , input = byId("mock-account-input")
          , error = byId("account-error")
          , accountList = byId("mock-account-list")
          , signalList = byId("mock-signal-list")
          , matchList = byId("mock-match-list")
          , accountCount = byId("account-count")
          , signalCount = byId("signal-count")
          , latency = byId("latency-value")
          , polling = byId("polling-enabled")
          , contractsOnly = byId("mock-contracts-only")
          , compact = byId("mock-compact")
          , largerText = byId("larger-text")
          , showExcerpts = byId("show-match-excerpts")
          , matchSearch = byId("match-search")
          , matchChain = byId("match-chain-filter")
          , matchSort = byId("match-sort")
          , clearMatches = byId("clear-matches")
          , matchSummary = byId("match-summary")
          , refreshButton = byId("refresh-tracker")
          , title = byId("title")
          , sub = byId("sub");
        if (!ui || !form || !input || !accountList || !signalList || !matchList)
            return;
        const storage = root.localStorage;
        let accounts = parseWatchlist(storage.getItem(KEYS.watchlist))
          , seenIds = parseSeenIds(storage.getItem(KEYS.seen))
          , matches = parseMatches(storage.getItem(KEYS.matches))
          , latestPosts = parseLatestPosts(storage.getItem(KEYS.latest))
          , preferences = parsePreferences(storage.getItem(KEYS.preferences))
          , activeRequest = null;
        const status = (heading, detail) => {
            if (title)
                title.textContent = heading;
            if (sub)
                sub.textContent = detail
        }
          , empty = (list, message) => list.replaceChildren(el("li", "empty-state", message));
        function save() {
            storage.setItem(KEYS.watchlist, serializeWatchlist(accounts));
            storage.setItem(KEYS.seen, JSON.stringify(seenIds.slice(-MAX_SEEN)));
            storage.setItem(KEYS.matches, JSON.stringify(matches.slice(0, MAX_MATCHES)));
            storage.setItem(KEYS.latest, JSON.stringify(latestPosts.slice(0, MAX_ACCOUNTS)));
            storage.setItem(KEYS.preferences, JSON.stringify(preferences))
        }
        function applyPreferences() {
            ui.classList.toggle("contracts-only", preferences.contractsOnly);
            ui.classList.toggle("compact", preferences.compact);
            ui.classList.toggle("larger-text", preferences.largerText);
            ui.classList.toggle("hide-match-excerpts", !preferences.showExcerpts);
            if (polling)
                polling.checked = preferences.polling;
            if (contractsOnly)
                contractsOnly.checked = preferences.contractsOnly;
            if (compact)
                compact.checked = preferences.compact;
            if (largerText)
                largerText.checked = preferences.largerText;
            if (showExcerpts)
                showExcerpts.checked = preferences.showExcerpts;
            if (matchSearch)
                matchSearch.value = preferences.matchQuery;
            if (matchChain)
                matchChain.value = preferences.matchChain;
            if (matchSort)
                matchSort.value = preferences.matchSort
        }
        function renderAccounts(statuses) {
            const latest = latestPostsByHandle(latestPosts);
            accountList.replaceChildren();
            if (!accounts.length)
                empty(accountList, "No accounts yet. Add an X handle to begin.");
            else
                for (const handle of accounts) {
                    const key = handle.toLowerCase()
                      , row = el("li", "account-row")
                      , avatar = el("span", "avatar", handle[0].toUpperCase())
                      , copy = el("div", "account-copy")
                      , remove = el("button", "remove-account", "Remove")
                      , statusValue = statuses?.[key]
                      , statusLabel = typeof statusValue === "string" ? statusValue : statusValue?.label || "Monitoring enabled"
                      , post = latest[key];
                    row.dataset.handle = handle;
                    avatar.setAttribute("aria-hidden", "true");
                    copy.append(el("p", "account-name", `@${handle}`), el("p", `account-handle ${statusValue?.state || ""}`, statusLabel));
                    if (post) {
                        const latestBox = el("article", "account-latest")
                          , latestTop = el("div", "account-latest-top")
                          , link = el("a", "account-post-link", "Open on X");
                        link.href = post.url;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                        latestTop.append(el("span", "account-post-label", "Latest post"), el("time", "account-post-time", relativeTime(post.publishedAt)));
                        latestBox.append(latestTop, el("p", "account-post-copy", post.text), link);
                        copy.append(latestBox)
                    }
                    remove.type = "button";
                    remove.setAttribute("aria-label", `Remove @${handle}`);
                    row.append(avatar, copy, remove);
                    accountList.append(row)
                }
            if (accountCount)
                accountCount.textContent = String(accounts.length)
        }
        function renderSignals(posts) {
            signalList.replaceChildren();
            if (!posts.length)
                empty(signalList, accounts.length ? "No public posts returned yet." : "Signals will appear after you add an account.");
            else
                for (const post of posts) {
                    const found = Array.isArray(post.contracts) && post.contracts.length
                      , item = el("li", `signal ${found ? "has-contract" : "is-mention"}`)
                      , avatar = el("span", "avatar", post.handle[0].toUpperCase())
                      , body = el("div", "signal-body")
                      , author = el("p", "signal-author");
                    avatar.setAttribute("aria-hidden", "true");
                    author.append(el("strong", "", `@${post.handle}`));
                    body.append(author, el("p", "signal-copy", post.text), el("p", "signal-time", relativeTime(post.publishedAt)));
                    item.append(avatar, body, el("span", `badge${found ? " hot" : ""}`, found ? "CA match" : "Post"));
                    signalList.append(item)
                }
            if (signalCount)
                signalCount.textContent = String(posts.length)
        }
        function renderMatches() {
            matchList.replaceChildren();
            const groups = groupMatchesByAccount(matches, {
                query: preferences.matchQuery,
                chain: preferences.matchChain,
                sort: preferences.matchSort
            })
              , visibleCount = groups.reduce( (sum, group) => sum + group.matches.length, 0);
            if (matchSummary)
                matchSummary.textContent = matches.length ? `${visibleCount} of ${matches.length} matches` : "Waiting for a contract";
            if (!matches.length) {
                empty(matchList, "Contract addresses will be organized here when they are found.");
                return
            }
            if (!groups.length) {
                empty(matchList, "No matches fit the selected filters.");
                return
            }
            for (const group of groups) {
                const groupItem = el("li", "match-account-group")
                  , header = el("header", "match-group-head")
                  , identity = el("div", "match-group-identity")
                  , avatar = el("span", "avatar", group.handle[0].toUpperCase())
                  , identityCopy = el("div")
                  , items = el("ol", "match-group-list");
                avatar.setAttribute("aria-hidden", "true");
                identityCopy.append(el("h3", "match-group-name", `@${group.handle}`), el("p", "match-group-meta", `${group.matches.length} contract${group.matches.length === 1 ? "" : "s"}`));
                identity.append(avatar, identityCopy);
                header.append(identity, el("time", "match-group-time", relativeTime(group.latestAt)));
                for (const match of group.matches) {
                    const card = el("li", "match-card")
                      , top = el("div", "match-top")
                      , actions = el("div", "match-actions")
                      , copy = el("button", "copy-contract", "Copy")
                      , safeUrl = safeExternalUrl(match.url);
                    top.append(el("strong", "ticker", match.chain), el("time", "match-time", relativeTime(match.publishedAt)));
                    copy.type = "button";
                    copy.dataset.address = match.address;
                    copy.setAttribute("aria-label", `Copy ${match.address}`);
                    actions.append(copy);
                    if (safeUrl) {
                        const source = el("a", "match-source", "View post");
                        source.href = safeUrl;
                        source.target = "_blank";
                        source.rel = "noopener noreferrer";
                        actions.append(source)
                    }
                    card.append(top, el("p", "address", match.address));
                    if (match.text)
                        card.append(el("p", "match-excerpt", match.text));
                    card.append(actions);
                    items.append(card)
                }
                groupItem.append(header, items);
                matchList.append(groupItem)
            }
        }
        async function refresh() {
            if (!accounts.length) {
                latestPosts = [];
                renderAccounts();
                renderSignals([]);
                status("Tracker ready", "Add up to 10 public X accounts. Your watchlist stays in this browser.");
                return
            }
            if (activeRequest)
                activeRequest.abort();
            const controller = new AbortController();
            activeRequest = controller;
            const started = performance.now();
            if (refreshButton)
                refreshButton.disabled = true;
            status("Scanning accounts", "Looking for new posts and contract mentions.");
            try {
                const query = new URLSearchParams({
                    handles: accounts.join(",")
                })
                  , response = await fetch(`/api/twitter?${query}`, {
                    signal: controller.signal
                })
                  , payload = await response.json().catch( () => ({}));
                if (!response.ok)
                    throw new Error(payload.error || "The timeline service is unavailable.");
                const posts = Array.isArray(payload.posts) ? payload.posts : []
                  , serverLatest = parseLatestPosts(JSON.stringify(Array.isArray(payload.latestPosts) ? payload.latestPosts : posts))
                  , merged = {
                    ...latestPostsByHandle(latestPosts),
                    ...latestPostsByHandle(serverLatest)
                }
                  , fresh = filterNewPosts(posts, seenIds)
                  , existing = new Set(matches.map(match => `${match.postId}:${match.address}`));
                let newMatchCount = 0;
                latestPosts = accounts.flatMap(handle => merged[handle.toLowerCase()] ? [merged[handle.toLowerCase()]] : []);
                seenIds = fresh.seenIds;
                for (const post of fresh.posts)
                    for (const match of Array.isArray(post.contracts) ? post.contracts : []) {
                        const key = `${post.id}:${match.address}`;
                        if (existing.has(key))
                            continue;
                        existing.add(key);
                        newMatchCount++;
                        matches.unshift({
                            ...match,
                            postId: post.id,
                            handle: post.handle,
                            text: post.text,
                            url: post.url,
                            publishedAt: post.publishedAt
                        })
                    }
                matches = matches.slice(0, MAX_MATCHES);
                const statuses = {};
                for (const result of payload.accounts || []) {
                    const state = result.status === "ok" ? result.cacheStatus || "uncached" : "error"
                      , labels = {
                        fresh: "Monitoring active",
                        updated: "New activity checked",
                        stale: "Showing saved activity",
                        uncached: "Monitoring active",
                        error: "Temporarily unavailable"
                    };
                    statuses[String(result.handle).toLowerCase()] = {
                        state,
                        label: labels[state] || labels.uncached
                    }
                }
                renderAccounts(statuses);
                renderSignals(latestPosts);
                renderMatches();
                save();
                if (latency)
                    latency.textContent = `${((performance.now() - started) / 1000).toFixed(1)} sec`;
                const warnings = Array.isArray(payload.warnings) ? payload.warnings.length : 0;
                if (newMatchCount)
                    status("New contract found", `${newMatchCount} new contract mention${newMatchCount === 1 ? "" : "s"} detected.`);
                else if (warnings)
                    status("Monitoring continues", `${warnings} account${warnings === 1 ? "" : "s"} will be checked again automatically.`);
                else
                    status("Monitoring is active", "No new contract mentions found.")
            } catch (reason) {
                if (reason.name !== "AbortError") {
                    renderAccounts();
                    renderSignals(latestPosts);
                    status("Showing saved activity", reason.message || "The tracker will check again automatically.")
                }
            } finally {
                if (activeRequest === controller) {
                    activeRequest = null;
                    if (refreshButton)
                        refreshButton.disabled = false
                }
            }
        }
        function updatePreference(key, value, rerender=false) {
            preferences[key] = value;
            applyPreferences();
            save();
            if (rerender)
                renderMatches()
        }
        form.addEventListener("submit", event => {
            event.preventDefault();
            const handle = normalizeHandle(input.value);
            if (!handle) {
                error.textContent = "Enter a valid X handle.";
                input.setAttribute("aria-invalid", "true");
                return
            }
            if (hasHandle(accounts, handle)) {
                error.textContent = "This account is already in your watchlist.";
                input.setAttribute("aria-invalid", "true");
                return
            }
            if (accounts.length >= MAX_ACCOUNTS) {
                error.textContent = "The free tracker supports up to 10 accounts.";
                input.setAttribute("aria-invalid", "true");
                return
            }
            accounts.push(handle);
            input.value = "";
            input.removeAttribute("aria-invalid");
            error.textContent = "";
            save();
            renderAccounts();
            refresh()
        }
        );
        accountList.addEventListener("click", event => {
            const button = event.target.closest(".remove-account");
            if (!button)
                return;
            const handle = button.closest("[data-handle]").dataset.handle;
            accounts = accounts.filter(account => account.toLowerCase() !== handle.toLowerCase());
            latestPosts = latestPosts.filter(post => post.handle.toLowerCase() !== handle.toLowerCase());
            save();
            renderAccounts();
            refresh()
        }
        );
        matchList.addEventListener("click", async event => {
            const button = event.target.closest(".copy-contract");
            if (!button)
                return;
            try {
                await navigator.clipboard.writeText(button.dataset.address);
                button.textContent = "Copied";
                root.setTimeout( () => button.textContent = "Copy", 1200)
            } catch {
                status("Could not copy", "Select the contract address manually.")
            }
        }
        );
        if (refreshButton)
            refreshButton.addEventListener("click", refresh);
        if (polling)
            polling.addEventListener("change", () => updatePreference("polling", polling.checked));
        if (contractsOnly)
            contractsOnly.addEventListener("change", () => updatePreference("contractsOnly", contractsOnly.checked));
        if (compact)
            compact.addEventListener("change", () => updatePreference("compact", compact.checked));
        if (largerText)
            largerText.addEventListener("change", () => updatePreference("largerText", largerText.checked));
        if (showExcerpts)
            showExcerpts.addEventListener("change", () => updatePreference("showExcerpts", showExcerpts.checked));
        if (matchChain)
            matchChain.addEventListener("change", () => updatePreference("matchChain", matchChain.value, true));
        if (matchSort)
            matchSort.addEventListener("change", () => updatePreference("matchSort", matchSort.value, true));
        if (matchSearch)
            matchSearch.addEventListener("input", () => updatePreference("matchQuery", matchSearch.value.slice(0, 100), true));
        if (clearMatches)
            clearMatches.addEventListener("click", () => {
                if (!root.confirm("Clear all saved contract matches?"))
                    return;
                matches = [];
                save();
                renderMatches();
                status("Match history cleared", "New contract mentions will appear when they are found.")
            }
            );
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden && preferences.polling)
                refresh()
        }
        );
        root.setInterval( () => {
            if (!document.hidden && preferences.polling)
                refresh()
        }
        , 300000);
        applyPreferences();
        renderAccounts();
        renderSignals(latestPosts);
        renderMatches();
        refresh();
    }
    const api = {
        normalizeHandle,
        hasHandle,
        serializeWatchlist,
        parseWatchlist,
        filterNewPosts,
        parseSeenIds,
        parseMatches,
        parseLatestPosts,
        latestPostsByHandle,
        safeExternalUrl,
        parsePreferences,
        groupMatchesByAccount
    };
    if (typeof module !== "undefined" && module.exports)
        module.exports = api;
    if (root && root.document) {
        if (root.document.readyState === "loading")
            root.document.addEventListener("DOMContentLoaded", init);
        else
            init()
    }
}
)(typeof window !== "undefined" ? window : null);

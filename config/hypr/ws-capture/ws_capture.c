/*
 * ws_capture.c - Capture workspace thumbnails using Hyprland's toplevel export protocol.
 *
 * For each populated workspace, captures every window using
 * hyprland_toplevel_export_manager_v1 (no workspace switching needed),
 * writes raw BGRA pixel data to /tmp/ws-win-<wsid>-<n>.raw + .meta,
 * then calls ImageMagick to composite them into /tmp/ws-overview-<wsid>.png.
 *
 * Usage: ws_capture [workspace_ids...]  (space separated, e.g. "1 2 3")
 *        If no args, capture all workspaces found.
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <errno.h>
#include <wayland-client.h>

#include "wlr-foreign-toplevel-management-v1-client.h"
#include "hyprland-toplevel-export-v1-client.h"

/* ── Data structures ──────────────────────────────────────────────────────── */

#define MAX_WINDOWS 64

typedef struct {
    struct zwlr_foreign_toplevel_handle_v1 *handle;
    char title[256];
    char app_id[128];
    int  ws_id;       /* filled from hyprctl data */
    int  x, y, w, h; /* filled from hyprctl data */

    /* capture state */
    struct hyprland_toplevel_export_frame_v1 *frame;
    uint32_t fmt, buf_w, buf_h, stride;
    int      shm_fd;
    void    *shm_data;
    size_t   shm_size;
    int      done;    /* 1=ready, -1=failed, 0=pending */
} Window;

static Window windows[MAX_WINDOWS];
static int    nwindows = 0;

static struct zwlr_foreign_toplevel_manager_v1  *toplevel_mgr = NULL;
static struct hyprland_toplevel_export_manager_v1 *export_mgr = NULL;
static struct wl_shm                              *shm         = NULL;
static int toplevel_roundtrip_done = 0;

/* ── wl_shm buffer helper ──────────────────────────────────────────────────── */

static int create_shm_file(size_t size) {
    char name[] = "/ws-cap-XXXXXX";
    int fd = shm_open(name, O_RDWR | O_CREAT | O_EXCL, 0600);
    if (fd < 0) return -1;
    shm_unlink(name);
    if (ftruncate(fd, size) < 0) { close(fd); return -1; }
    return fd;
}

/* ── hyprland_toplevel_export_frame_v1 listeners ─────────────────────────── */

static void frame_buffer(void *data,
    struct hyprland_toplevel_export_frame_v1 *frame,
    uint32_t fmt, uint32_t w, uint32_t h, uint32_t stride)
{
    Window *win = data;
    win->fmt    = fmt;
    win->buf_w  = w;
    win->buf_h  = h;
    win->stride = stride;
}

static void frame_damage(void *data,
    struct hyprland_toplevel_export_frame_v1 *f,
    uint32_t x, uint32_t y, uint32_t w, uint32_t h) {}

static void frame_flags(void *data,
    struct hyprland_toplevel_export_frame_v1 *f, uint32_t flags) {}

static void frame_ready(void *data,
    struct hyprland_toplevel_export_frame_v1 *f,
    uint32_t tv_sec_hi, uint32_t tv_sec_lo, uint32_t tv_nsec)
{
    Window *win = data;
    win->done = 1;
}

static void frame_failed(void *data,
    struct hyprland_toplevel_export_frame_v1 *f)
{
    Window *win = data;
    win->done = -1;
}

static void frame_linux_dmabuf(void *data,
    struct hyprland_toplevel_export_frame_v1 *f,
    uint32_t fmt, uint32_t w, uint32_t h) {}

static void frame_buffer_done(void *data,
    struct hyprland_toplevel_export_frame_v1 *frame)
{
    Window *win = data;

    /* Allocate shm buffer and submit copy request */
    win->shm_size = (size_t)win->stride * win->buf_h;
    win->shm_fd   = create_shm_file(win->shm_size);
    if (win->shm_fd < 0) { win->done = -1; return; }

    win->shm_data = mmap(NULL, win->shm_size, PROT_READ | PROT_WRITE,
                         MAP_SHARED, win->shm_fd, 0);
    if (win->shm_data == MAP_FAILED) { win->done = -1; close(win->shm_fd); return; }

    struct wl_shm_pool *pool = wl_shm_create_pool(shm, win->shm_fd, win->shm_size);
    struct wl_buffer   *buf  = wl_shm_pool_create_buffer(pool, 0,
                                    win->buf_w, win->buf_h, win->stride, win->fmt);
    wl_shm_pool_destroy(pool);

    hyprland_toplevel_export_frame_v1_copy(frame, buf, 0);
    wl_buffer_destroy(buf);
}

static const struct hyprland_toplevel_export_frame_v1_listener frame_listener = {
    .buffer      = frame_buffer,
    .damage      = frame_damage,
    .flags       = frame_flags,
    .ready       = frame_ready,
    .failed      = frame_failed,
    .linux_dmabuf = frame_linux_dmabuf,
    .buffer_done = frame_buffer_done,
};

/* ── zwlr_foreign_toplevel_handle_v1 listeners ───────────────────────────── */

static void tl_title(void *data, struct zwlr_foreign_toplevel_handle_v1 *h, const char *t) {
    Window *win = data;
    snprintf(win->title, sizeof(win->title), "%s", t ? t : "");
}
static void tl_app_id(void *data, struct zwlr_foreign_toplevel_handle_v1 *h, const char *a) {
    Window *win = data;
    snprintf(win->app_id, sizeof(win->app_id), "%s", a ? a : "");
}
static void tl_output_enter(void *d, struct zwlr_foreign_toplevel_handle_v1 *h, struct wl_output *o) {}
static void tl_output_leave(void *d, struct zwlr_foreign_toplevel_handle_v1 *h, struct wl_output *o) {}
static void tl_state(void *d, struct zwlr_foreign_toplevel_handle_v1 *h, struct wl_array *a) {}
static void tl_done(void *d, struct zwlr_foreign_toplevel_handle_v1 *h) {}
static void tl_closed(void *data, struct zwlr_foreign_toplevel_handle_v1 *h) {
    Window *win = data;
    win->handle = NULL;
}
static void tl_parent(void *d, struct zwlr_foreign_toplevel_handle_v1 *h,
                       struct zwlr_foreign_toplevel_handle_v1 *p) {}

static const struct zwlr_foreign_toplevel_handle_v1_listener tl_listener = {
    .title        = tl_title,
    .app_id       = tl_app_id,
    .output_enter = tl_output_enter,
    .output_leave = tl_output_leave,
    .state        = tl_state,
    .done         = tl_done,
    .closed       = tl_closed,
    .parent       = tl_parent,
};

/* ── zwlr_foreign_toplevel_manager_v1 listeners ──────────────────────────── */

static void mgr_toplevel(void *data,
    struct zwlr_foreign_toplevel_manager_v1 *mgr,
    struct zwlr_foreign_toplevel_handle_v1 *handle)
{
    if (nwindows >= MAX_WINDOWS) return;
    Window *win = &windows[nwindows++];
    memset(win, 0, sizeof(*win));
    win->handle  = handle;
    win->shm_fd  = -1;
    win->done    = 0;
    zwlr_foreign_toplevel_handle_v1_add_listener(handle, &tl_listener, win);
}

static void mgr_finished(void *data,
    struct zwlr_foreign_toplevel_manager_v1 *mgr)
{
    toplevel_roundtrip_done = 1;
}

static const struct zwlr_foreign_toplevel_manager_v1_listener mgr_listener = {
    .toplevel = mgr_toplevel,
    .finished = mgr_finished,
};

/* ── wl_registry ──────────────────────────────────────────────────────────── */

static void registry_global(void *data, struct wl_registry *reg,
    uint32_t name, const char *interface, uint32_t version)
{
    if (strcmp(interface, zwlr_foreign_toplevel_manager_v1_interface.name) == 0) {
        toplevel_mgr = wl_registry_bind(reg, name,
            &zwlr_foreign_toplevel_manager_v1_interface,
            version < 3 ? version : 3);
        zwlr_foreign_toplevel_manager_v1_add_listener(toplevel_mgr, &mgr_listener, NULL);
    } else if (strcmp(interface, hyprland_toplevel_export_manager_v1_interface.name) == 0) {
        export_mgr = wl_registry_bind(reg, name,
            &hyprland_toplevel_export_manager_v1_interface,
            version < 2 ? version : 2);
    } else if (strcmp(interface, wl_shm_interface.name) == 0) {
        shm = wl_registry_bind(reg, name, &wl_shm_interface, 1);
    }
}

static void registry_global_remove(void *data, struct wl_registry *r, uint32_t n) {}

static const struct wl_registry_listener registry_listener = {
    .global        = registry_global,
    .global_remove = registry_global_remove,
};

/* ── main ─────────────────────────────────────────────────────────────────── */

int main(int argc, char *argv[]) {
    struct wl_display *display = wl_display_connect(NULL);
    if (!display) { fprintf(stderr, "ws_capture: cannot connect to Wayland\n"); return 1; }

    struct wl_registry *registry = wl_display_get_registry(display);
    wl_registry_add_listener(registry, &registry_listener, NULL);
    wl_display_roundtrip(display);

    if (!toplevel_mgr) { fprintf(stderr, "ws_capture: no zwlr_foreign_toplevel_manager_v1\n"); return 1; }
    if (!export_mgr)   { fprintf(stderr, "ws_capture: no hyprland_toplevel_export_manager_v1\n"); return 1; }
    if (!shm)          { fprintf(stderr, "ws_capture: no wl_shm\n"); return 1; }

    /* Collect all toplevels */
    wl_display_roundtrip(display);
    wl_display_roundtrip(display);

    /* Read geometry from hyprctl clients -j via stdin (piped in by the shell wrapper) */
    /* Format per line: <title_prefix>\t<ws_id>\t<x>\t<y>\t<w>\t<h> */
    char linebuf[1024];
    while (fgets(linebuf, sizeof(linebuf), stdin)) {
        char title[256];
        int ws_id, x, y, w, h;
        if (sscanf(linebuf, "%255[^\t]\t%d\t%d\t%d\t%d\t%d",
                   title, &ws_id, &x, &y, &w, &h) == 6) {
            /* Match by title prefix to a window */
            for (int i = 0; i < nwindows; i++) {
                if (strncmp(windows[i].title, title, strlen(title)) == 0 && windows[i].ws_id == 0) {
                    windows[i].ws_id = ws_id;
                    windows[i].x = x;
                    windows[i].y = y;
                    windows[i].w = w;
                    windows[i].h = h;
                    break;
                }
            }
        }
    }

    /* Kick off captures for all windows using capture_toplevel_with_wlr_toplevel_handle */
    for (int i = 0; i < nwindows; i++) {
        Window *win = &windows[i];
        if (!win->handle) continue;
        win->frame = hyprland_toplevel_export_manager_v1_capture_toplevel_with_wlr_toplevel_handle(
            export_mgr, 0 /*no cursor*/, win->handle);
        hyprland_toplevel_export_frame_v1_add_listener(win->frame, &frame_listener, win);
    }
    wl_display_flush(display);

    /* Wait for all captures to complete */
    int pending = nwindows;
    while (pending > 0) {
        wl_display_dispatch(display);
        pending = 0;
        for (int i = 0; i < nwindows; i++) {
            if (windows[i].handle && windows[i].done == 0) pending++;
        }
    }

    /* Write raw pixel data and metadata files */
    for (int i = 0; i < nwindows; i++) {
        Window *win = &windows[i];
        if (!win->handle || win->done != 1 || !win->shm_data) continue;

        char raw_path[256], meta_path[256];
        snprintf(raw_path,  sizeof(raw_path),  "/tmp/ws-win-%d-%d.raw",  win->ws_id, i);
        snprintf(meta_path, sizeof(meta_path), "/tmp/ws-win-%d-%d.meta", win->ws_id, i);

        /* Write raw pixels */
        int fd = open(raw_path, O_WRONLY | O_CREAT | O_TRUNC, 0644);
        if (fd >= 0) {
            write(fd, win->shm_data, win->shm_size);
            close(fd);
        }

        /* Write metadata: format width height stride ws_id x y w h title */
        FILE *mf = fopen(meta_path, "w");
        if (mf) {
            fprintf(mf, "%u %u %u %u %d %d %d %d %d %s\n",
                win->fmt, win->buf_w, win->buf_h, win->stride,
                win->ws_id, win->x, win->y, win->w, win->h,
                win->title);
            fclose(mf);
        }

        munmap(win->shm_data, win->shm_size);
        close(win->shm_fd);
    }

    /* Print list of workspace IDs that have captures, for the shell wrapper */
    /* Collect unique ws_ids */
    int seen[64] = {0};
    for (int i = 0; i < nwindows; i++) {
        int ws = windows[i].ws_id;
        if (ws > 0 && ws <= 63 && windows[i].done == 1) {
            if (!seen[ws]) { printf("%d\n", ws); seen[ws] = 1; }
        }
    }

    wl_display_disconnect(display);
    return 0;
}

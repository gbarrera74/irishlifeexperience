<?php
/**
 * Read-only export of a WordPress + Elementor site to JSON.
 *
 * Usage (on the server, from the site docroot):
 *   php wp_export.php /path/to/outdir
 *
 * Writes site.json, pages.json, posts.json, templates.json, media.json,
 * menus.json, redirects.json. Nothing in WordPress is modified.
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$out = $argv[1] ?? './wpexport';
if (!is_dir($out) && !mkdir($out, 0755, true)) {
    die("cannot create $out\n");
}

// wp-load.php must be in the current directory (the docroot).
require_once __DIR__ . '/wp-load.php';

function w($out, $name, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    file_put_contents("$out/$name", $json);
    printf("%-18s %6d entries  %s\n", $name,
        is_array($data) ? count($data) : 1,
        size_h(strlen($json)));
}

function size_h($b) {
    $u = ['B', 'K', 'M', 'G'];
    $i = 0;
    while ($b >= 1024 && $i < 3) { $b /= 1024; $i++; }
    return round($b, 1) . $u[$i];
}

/** Elementor stores its tree as a JSON string in _elementor_data. */
function elementor_tree($id) {
    $raw = get_post_meta($id, '_elementor_data', true);
    if (!$raw) return null;
    $tree = is_string($raw) ? json_decode($raw, true) : $raw;
    return is_array($tree) ? $tree : null;
}

/** Yoast + generic SEO meta, only the keys that carry a value. */
function seo_meta($id) {
    $keys = [
        '_yoast_wpseo_title'                 => 'title',
        '_yoast_wpseo_metadesc'              => 'description',
        '_yoast_wpseo_canonical'             => 'canonical',
        '_yoast_wpseo_focuskw'               => 'focus_keyword',
        '_yoast_wpseo_meta-robots-noindex'   => 'noindex',
        '_yoast_wpseo_meta-robots-nofollow'  => 'nofollow',
        '_yoast_wpseo_opengraph-title'       => 'og_title',
        '_yoast_wpseo_opengraph-description' => 'og_description',
        '_yoast_wpseo_opengraph-image'       => 'og_image',
    ];
    $seo = [];
    foreach ($keys as $meta => $label) {
        $v = get_post_meta($id, $meta, true);
        if ($v !== '' && $v !== null) $seo[$label] = $v;
    }
    return $seo;
}

function featured($id) {
    $tid = get_post_thumbnail_id($id);
    if (!$tid) return null;
    return [
        'id'  => (int) $tid,
        'url' => wp_get_attachment_url($tid),
        'alt' => get_post_meta($tid, '_wp_attachment_image_alt', true),
    ];
}

function export_post($p) {
    $tree = elementor_tree($p->ID);
    return [
        'id'                   => (int) $p->ID,
        'slug'                 => $p->post_name,
        'title'                => html_entity_decode(get_the_title($p), ENT_QUOTES, 'UTF-8'),
        'status'               => $p->post_status,
        // A password-protected post is 'publish' but is NOT publicly readable.
        // Exported as a flag, never the password itself. Anything that renders
        // content must honour this or it publishes what the site gates.
        'password_protected'   => $p->post_password !== '',
        'date'                 => $p->post_date,
        'modified'             => $p->post_modified,
        'excerpt'              => $p->post_excerpt,
        'parent'               => (int) $p->post_parent,
        'menu_order'           => (int) $p->menu_order,
        'permalink'            => get_permalink($p),
        'author'               => get_the_author_meta('user_login', $p->post_author),
        // The post body with shortcodes/blocks left intact; tags stripped of
        // attributes so it stays readable as a text reference.
        'content_raw'          => wp_strip_all_tags(
                                      apply_filters('the_content', $p->post_content), false),
        'built_with_elementor' => (bool) $tree,
        'elementor_data'       => $tree,
        'seo'                  => seo_meta($p->ID),
        'featured_image'       => featured($p->ID),
    ];
}

// ---------------------------------------------------------------- site

$uploads = wp_upload_dir();
$uploads_bytes = 0;
if (is_dir($uploads['basedir'])) {
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($uploads['basedir'], FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) if ($f->isFile()) $uploads_bytes += $f->getSize();
}

w($out, 'site.json', [
    'blogname'            => get_option('blogname'),
    'blogdescription'     => get_option('blogdescription'),
    'siteurl'             => get_option('siteurl'),
    'home'                => get_option('home'),
    'date_format'         => get_option('date_format'),
    'time_format'         => get_option('time_format'),
    'posts_per_page'      => (int) get_option('posts_per_page'),
    'permalink_structure' => get_option('permalink_structure'),
    'page_on_front'       => (int) get_option('page_on_front'),
    'page_for_posts'      => (int) get_option('page_for_posts'),
    'start_of_week'       => (int) get_option('start_of_week'),
    'timezone_string'     => get_option('timezone_string'),
    'active_plugins'      => get_option('active_plugins'),
    'wp_version'          => get_bloginfo('version'),
    'uploads_bytes'       => $uploads_bytes,
    'stylesheet'          => get_option('stylesheet'),
    'template'            => get_option('template'),
]);

// ---------------------------------------------------------------- pages

$pages = get_posts([
    'post_type'   => 'page',
    'post_status' => ['publish', 'draft', 'private', 'pending'],
    'numberposts' => -1,
    'orderby'     => 'title',
    'order'       => 'ASC',
]);
w($out, 'pages.json', array_map('export_post', $pages));

// ---------------------------------------------------------------- posts

$posts = get_posts([
    'post_type'   => 'post',
    'post_status' => ['publish', 'draft', 'private', 'pending'],
    'numberposts' => -1,
    'orderby'     => 'date',
    'order'       => 'DESC',
]);
w($out, 'posts.json', array_map(function ($p) {
    $row = export_post($p);
    $row['categories'] = wp_get_post_terms($p->ID, 'category', ['fields' => 'names']);
    $row['tags']       = wp_get_post_terms($p->ID, 'post_tag', ['fields' => 'names']);
    return $row;
}, $posts));

// ------------------------------------------------- other public post types

$builtin = ['page', 'post', 'attachment', 'revision', 'nav_menu_item',
            'custom_css', 'customize_changeset', 'oembed_cache',
            'user_request', 'wp_block', 'wp_template', 'wp_template_part',
            'wp_global_styles', 'wp_navigation', 'elementor_library'];
$cpts = [];
foreach (get_post_types(['public' => true], 'names') as $pt) {
    if (in_array($pt, $builtin, true)) continue;
    $rows = get_posts([
        'post_type'   => $pt,
        'post_status' => ['publish', 'draft', 'private'],
        'numberposts' => -1,
    ]);
    if ($rows) $cpts[$pt] = array_map('export_post', $rows);
}
if ($cpts) w($out, 'cpt.json', $cpts);

// ------------------------------------------------- Elementor library templates

$templates = get_posts([
    'post_type'   => 'elementor_library',
    'post_status' => ['publish', 'draft'],
    'numberposts' => -1,
]);
w($out, 'templates.json', array_map(function ($p) {
    $row = export_post($p);
    $row['template_type'] = get_post_meta($p->ID, '_elementor_template_type', true);
    // Which theme locations this template is assigned to (header/footer/popup).
    $cond = get_post_meta($p->ID, '_elementor_conditions', true);
    $row['conditions'] = $cond ?: null;
    return $row;
}, $templates));

// ---------------------------------------------------------------- media

$attachments = get_posts([
    'post_type'   => 'attachment',
    'post_status' => 'inherit',
    'numberposts' => -1,
]);
w($out, 'media.json', array_map(function ($a) {
    $path = get_attached_file($a->ID);
    return [
        'id'      => (int) $a->ID,
        'url'     => wp_get_attachment_url($a->ID),
        'path'    => $path,
        'mime'    => $a->post_mime_type,
        'alt'     => get_post_meta($a->ID, '_wp_attachment_image_alt', true),
        'title'   => html_entity_decode(get_the_title($a), ENT_QUOTES, 'UTF-8'),
        'bytes'   => ($path && file_exists($path)) ? filesize($path) : 0,
        'used_by' => (int) $a->post_parent,
    ];
}, $attachments));

// ---------------------------------------------------------------- menus

$menus = [];
foreach (wp_get_nav_menus() as $menu) {
    $items = wp_get_nav_menu_items($menu->term_id) ?: [];
    $menus[] = [
        'name'  => $menu->name,
        'slug'  => $menu->slug,
        'items' => array_map(function ($i) {
            return [
                'id'        => (int) $i->ID,
                'title'     => html_entity_decode($i->title, ENT_QUOTES, 'UTF-8'),
                'url'       => $i->url,
                'parent'    => $i->menu_item_parent,
                'order'     => (int) $i->menu_order,
                'type'      => $i->type,
                'object'    => $i->object,
                'object_id' => $i->object_id,
            ];
        }, $items),
    ];
}
w($out, 'menus.json', $menus);

// Which menu is assigned to which theme location.
w($out, 'menu_locations.json', get_nav_menu_locations());

// ---------------------------------------------------------------- redirects

global $wpdb;
$redirects = [];
$table = $wpdb->prefix . 'redirection_items';
if ($wpdb->get_var("SHOW TABLES LIKE '$table'") === $table) {
    $redirects = $wpdb->get_results(
        "SELECT url, match_url, action_data, action_code, regex, status, last_count
         FROM $table ORDER BY id", ARRAY_A);
}
w($out, 'redirects.json', $redirects);

// ------------------------------------------------- Elementor kit / global settings

$kit_id = (int) get_option('elementor_active_kit');
w($out, 'kit.json', [
    'kit_id'   => $kit_id,
    'settings' => $kit_id ? get_post_meta($kit_id, '_elementor_page_settings', true) : null,
]);

echo "\ndone -> $out\n";

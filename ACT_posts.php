<?php
/**
 * Plugin Name: ACT Posts Plugin
 * Plugin URI:  https://sites.stringerhj.co.uk/ACT/WP_plugins/ACT_posts/html/ACT_posts.html
 * Description: A custom plugin to display posts in a responsive grid with infinite scroll and filtering.
 * Version:     1.1.0
 * Author: Julian Stringer
 * Author URI:  https://your-website.com/
 * License:     GPL-2.0+
 * License URI: http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain: act-posts
 * Domain Path: /languages
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
// Enable ACF shortcodes
// In your theme's functions.php file or a custom plugin
/*
add_action( 'acf/init', 'my_acf_enable_shortcode_setting' );
function my_acf_enable_shortcode_setting() {
    // Enable the ACF shortcode. USE WITH CAUTION due to security implications.
    // It is disabled by default from ACF 6.3.0
    acf_update_setting( 'enable_shortcode', true );
}
*/
/**
 * Register post types, with REST API support
 *
 * Based on example at: https://developer.wordpress.org/reference/functions/register_post_type
 */
/*
add_action( 'init', 'register_custom_post_types' );
function register_custom_post_types() {
    $args = array(
      'public'       => true,
      'show_in_rest' => true,
      'label'        => 'Team',
      'supports'     => array( 'title', 'editor', 'thumbnail' ) 
    );
    register_post_type( 'team', $args );
//    $args['label'] = 'Events';
//    register_post_type( 'event', $args);
}
*/
/**
 * Add a featured image column to the custom post type list table.
 */
function add_thumbnail_column_to_team_list( $columns ) {
    $new_columns = array();
    foreach ( $columns as $key => $title ) {
        $new_columns[ $key ] = $title;
        if ( 'title' === $key ) { // Insert after the 'title' column
            $new_columns['team_thumbnail'] = 'Thumbnail';
        }
    }
    return $new_columns;
}
add_filter( 'manage_team_posts_columns', 'add_thumbnail_column_to_team_list' ); // Replace 'team_member' with your custom post type slug

/**
 * Populate the featured image column with the thumbnail.
 */
function display_thumbnail_column_for_team_list( $column, $post_id ) {
    if ( 'team_thumbnail' === $column ) {
        if ( has_post_thumbnail( $post_id ) ) {
            echo '<a href="' . get_edit_post_link( $post_id ) . '">' . get_the_post_thumbnail( $post_id, array( 50, 50 ) ) . '</a>'; // Adjust size as needed
        } else {
            echo '—'; // No thumbnail
        }
    }
}
add_action( 'manage_team_posts_custom_column', 'display_thumbnail_column_for_team_list', 10, 2 ); // Replace 'team_member' with your custom post type slug
/**
 * Make the thumbnail column sortable (optional, but good for user experience).
 */
function make_thumbnail_column_sortable( $columns ) {
    $columns['team_thumbnail'] = 'team_thumbnail'; // The key must match the column ID
    return $columns;
}
// You generally wouldn't make the thumbnail column sortable by default, as it's not a direct sortable value.
// If you did want to sort by presence of a thumbnail, it would require custom query modifications.
// This is more for columns with direct textual/numerical values.
//add_filter( 'manage_edit-team_sortable_columns', 'make_thumbnail_column_sortable' );
/**
 * Main ACT_Posts_Plugin Class.
 */
class ACT_Posts_Plugin {

    private static $instance = null;
    /**
     * Singleton instance.
     */
    public static function get_instance() {
        if ( is_null( self::$instance ) ) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    /**
     * Stores attributes for the current shortcode instance.
     * @var array
     */
    private $current_shortcode_atts = array();
    /**
     * Constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'register_shortcode' ) );
    }

    /**
     * Register the [act_posts] shortcode.
     */
    public function register_shortcode() {
        add_shortcode( 'act_posts', array( $this, 'render_posts_grid_shortcode' ) );
    }
    private function show_post_controls($initial_cateory_ids, $categories, $sortby, $sortorder){
        ?>

        <table class="act-posts-grid-controls">
            <tr class="act-posts-category-filter">
                <td>
                    <label for="act-posts-category-select"><?php esc_html_e( 'Category:', 'act-posts' ); ?></label>
                </td>
                <td>
                    <select id="act-posts-category-select" multiple size="6">
                        <option value=""
                            <?php 
                            // Check if no categories are selected initially then all categories is selected
                            if ( empty( $initial_category_ids ) ) {
                                echo 'selected'; 
                            }
                            ?>
                            ><?php esc_html_e( 'All Categories ') ?> 
                            (<span class="act-posts-category-count" data-term-id="all"></span>)
                        </option>
                        <?php
                            foreach ( $categories as $category_obj ) {
                                $selected = '';
                                foreach( $initial_category_ids as $initial_category_id ) {
                                    if ( selected( $initial_category_id, $category_obj->term_id, false )){
                                        $selected = 'selected';
                                    }
                                }
                                echo '<option value="' . esc_attr( $category_obj->term_id ) . '" ' . $selected . '>' 
                                . esc_html( $category_obj->name ) .
                                '(<span class="act-posts-category-count" data-term-id="' . 
                                            esc_attr( $category_obj->term_id ) . '"></span>)'.
                                    '</option>'; // Placeholder for count
                            }
                        ?>
                    </select>
                </td>
            </tr>
            <tr class="act-posts-search-box">
                <td>
                    <label for="act-posts-search-input"><?php esc_html_e( 'Search:', 'act-posts' ); ?></label>
                </td>
                <td>
                <input type="text" id="act-posts-search-input" placeholder="<?php esc_attr_e( 'Enter keywords or "phrase"', 'act-posts' ); ?>">
                </td>
            </tr>
            <tr class="act-posts-sort-controls">
                <td>
                    <label for="act-posts-sort-select"><?php esc_html_e( 'Sort by:', 'act-posts' ); ?></label>
                </td>
                <td>
                    <select id="act-posts-sort-select">
                        <option value="date_desc" <?php selected( $sortby === 'date' && $sortorder === 'desc' ); ?>><?php esc_html_e( 'Most Recent', 'act-posts' ); ?></option>
                        <option value="date_asc" <?php selected( $sortby === 'date' && $sortorder === 'asc' ); ?>><?php esc_html_e( 'Least Recent', 'act-posts' ); ?></option>
                        <option value="author_asc" <?php selected( $sortby === 'author' && $sortorder === 'asc' ); ?>><?php esc_html_e( 'Author (A-Z)', 'act-posts' ); ?></option>
                        <option value="author_desc" <?php selected( $sortby === 'author' && $sortorderatts['sort_order'] === 'desc' ); ?>><?php esc_html_e( 'Author (Z-A)', 'act-posts' ); ?></option>
                    </select>
                </td>
            </tr>
            <tr>
                <td>
                    <label for="act-posts-selected" >Selected</label>
                </td>
                <td>
                    <span id="act-posts-selected"></span>
                </td>
            </tr>
        </table>
        <?php 
    }
    /**
     * Renders the controls for filtering 'event' post types (date/time picker).
     *
     * @param string $initial_window_start_html The initial start date/time for the HTML input.
     */
    private function show_event_controls( $initial_window_start_html) {
        ?>
        <div class="act-event-controls">
            <div class="date-time-filter">
                <label for="event-window-start"><?php esc_html_e( 'Events from:', 'act-posts' ); ?></label>
                <input type="datetime-local" id="event-window-start"
                       value="<?php echo esc_attr( $initial_window_start_html ); ?>">
            </div>
        </div>
        <?php
    }
    /**
     * Render the HTML for the posts grid.
     * This function should only output the container and controls.
     * Actual post fetching and rendering will be done via JavaScript/REST API.
     *
     * @param array $atts Shortcode attributes.
     * @return string HTML output.
     */
    public function render_posts_grid_shortcode( $atts ) {

        // --- Determine initial date window for 'event' post type ---
        //$initial_window_start = new DateTime(); // Default to current time
        $initial_window_start = new DateTime('now', new DateTimeZone(wp_timezone_string())); // Explicitly set to site's local time

        // Parse shortcode attributes (e.g., to set default category, sort options, excerpt length)
        $atts = shortcode_atts( array(
            'category'        => '', // ID, slug, or comma-separated list for initial shortcode filter
            'sort_by'         => 'date', // 'date', 'author'
            'sort_order'      => 'desc', // 'asc', 'desc'
            'excerpt_length'  => 150, // Default character limit for fallback excerpt
            //'posts_per_page'  => 100, // Allow shortcode to override global default
            'post_type'       => 'posts',      // rest api schema to fetch
            'has_controls'    => 'yes',  // determines if controls are displayed
            // New attributes for 'event' post type:
            'window_start'    => '',          // Initial window start datetime (e.g., 'now', '2025-01-01 00:00:00')
        ), $atts, 'act_posts' );

        $post_type = sanitize_key( $atts['post_type'] ); // Sanitize post type
        // If window_start is provided in shortcode or URL
        if ( ! empty( $_GET['window_start'] ) ) {
            $initial_window_start = new DateTime( sanitize_text_field( $_GET['window_start'] ) );
        } elseif ( ! empty( $atts['window_start'] ) && $atts['window_start'] !== 'now' ) {
            $initial_window_start = new DateTime( sanitize_text_field( $atts['window_start'] ) );
        }

        // Determine the initial category ID for the REST API
        $initial_category_ids = array();
        $initial_category_slugs_names = array();
        if ( isset( $_GET['category'] ) ) {
            // Ensure $_GET['category'] is always an array
            $url_categories = is_array( $_GET['category'] ) ? $_GET['category'] : explode( ',', $_GET['category'] );
            $initial_category_slugs_names = array_merge( $initial_category_slugs_names, $url_categories );
        }
        if ( ! empty( $atts['category'] ) ) {
            $shortcode_categories = explode( ',', $atts['category'] );
            $initial_category_slugs_names = array_merge( $initial_category_slugs_names, $shortcode_categories );
        }
        // Convert all collected slugs/names to IDs
        $initial_category_slugs_names = array_unique( array_map( 'trim', $initial_category_slugs_names ) );
        foreach ( $initial_category_slugs_names as $term_identifier ) {
            if ( empty( $term_identifier ) ) continue;
            // remove url encoding from $term_identifier
            $term_identifier = urldecode( $term_identifier );
            $term = null;
            if ( is_numeric( $term_identifier ) ) {
                $term = get_term_by( 'id', (int) $term_identifier, 'category' );
            } else {
                $term = get_term_by( 'slug', $term_identifier, 'category' );
                if ( ! $term ) {
                    $term = get_term_by( 'name', $term_identifier, 'category' );
                }
            }
            if ( $term && ! is_wp_error( $term ) ) {
                $initial_category_ids[] = $term->term_id;
            }
        }
        $initial_category_ids = array_unique( $initial_category_ids ); // Ensure unique IDs
        // Store the determined attributes in the class property to be accessible by enqueue_scripts
        $this->current_shortcode_atts = array(
            'initial_category_ids' => $initial_category_ids,
            'initial_sort_by'      => $atts['sort_by'],
            'initial_sort_order'   => $atts['sort_order'],
            'excerpt_length'       => $atts['excerpt_length'],
            //'posts_per_page'       => $atts['posts_per_page'],
            'post_type'            => $atts['post_type'],
            'initial_window_start' => $initial_window_start->format( DateTime::ATOM ),
        );
        $this->enqueue_scripts($this->current_shortcode_atts);
                            
        ob_start(); // Start output buffering
            ?>
            <div class="act-posts-grid-wrapper">
                <?php
        if ( $atts['has_controls'] === 'yes'){
            if ( $atts['post_type'] === 'event' ){
                // Call the new function for event controls
                $this->show_event_controls(
                    $initial_window_start->format( 'Y-m-d\TH:i' ) // HTML datetime-local format
                );
            } else {
                // Get all categories
                $categories = get_categories( array(
                    'hide_empty' => true, // Only show categories with posts
                ) );
                $this->show_post_controls($initial_category_ids, $categories, $atts['sort_by'], $atts['sort_order']);            
            }
        }
        ?>
                <div id="act-posts-grid-container" class="act-posts-grid-container">
                </div>

                <div id="act-posts-infinite-scroll-trigger" class="act-posts-infinite-scroll-trigger"></div>

                <div id="act-posts-loading-spinner" class="act-posts-loading-spinner" style="display: none;">
                    <p><?php esc_html_e( 'Loading more posts...', 'act-posts' ); ?></p>
                </div>

                <div id="act-posts-no-results" class="act-posts-no-results" style="display: none;">
                    <p><?php esc_html_e( 'No posts found matching your criteria.', 'act-posts' ); ?></p>
                </div>

            </div><?php
        return ob_get_clean(); // Return the buffered HTML
    }
    /**
     * Enqueue plugin scripts and styles.
     */
    private function enqueue_scripts($atts) {
        // Enqueue CSS
        wp_enqueue_style(
            'act-posts-style',
            plugin_dir_url( __FILE__ ) . 'assets/css/act-posts.css',
            array(), // No dependencies
            filemtime( plugin_dir_path( __FILE__ ) . 'assets/css/act-posts.css' ) // Versioning for cache busting
        );

        // Enqueue JavaScript
        wp_enqueue_script(
            'act-posts-script',
            plugin_dir_url( __FILE__ ) . 'assets/js/act-posts.js',
            array( 'jquery' ), // Add jQuery as a dependency if you use it, otherwise remove.
                               // Modern JS for Fetch API doesn't strictly need jQuery, but common in WP.
            filemtime( plugin_dir_path( __FILE__ ) . 'assets/js/act-posts.js' ), // Versioning
            true // Load script in the footer
        );
        // Get the shortcode attributes that were processed.
        // If the shortcode wasn't used on the page, this will be empty,
        // so we'll use default fallback values.
        //$atts = $this->current_shortcode_atts;

        // Default values for actPostsData if shortcode wasn't rendered on the page,
        // or if it was, use the values stored in $this->current_shortcode_atts
        $post_type = isset( $atts['post_type']) ? $atts['post_type'] : 'posts';
        $localized_data = array(
            'rest_url'           => get_rest_url() . 'wp/v2/' . $post_type,
            'nonce'              => wp_create_nonce( 'wp_rest' ), // For future authenticated requests if needed
            //'posts_per_page'     => isset( $atts['posts_per_page'] ) ? (int) $atts['posts_per_page'] : 100,
            'initial_category_ids'=> isset( $atts['initial_category_ids'] ) ? $atts['initial_category_ids'] : '',
            'initial_sort_by'    => isset( $atts['initial_sort_by'] ) ? $atts['initial_sort_by'] : 'date',
            'initial_sort_order' => isset( $atts['initial_sort_order'] ) ? $atts['initial_sort_order'] : 'desc',
            'excerpt_length'     => isset( $atts['excerpt_length'] ) ? (int) $atts['excerpt_length'] : 150,
            'show_category_filter' => isset( $atts['show_category_filter'] ) ? $atts['show_category_filter'] : false,
            'show_sort_controls'   => isset( $atts['show_sort_controls'] ) ? $atts['show_sort_controls'] : false,
            // New attributes for 'event' type
            'initial_window_start' => isset( $atts['initial_window_start'] ) ? $atts['initial_window_start'] : '',
            'initial_window_end'   => isset( $atts['initial_window_end'] ) ? $atts['initial_window_end'] : '',

            'home_url'           => home_url(), // Useful for relative URLs or site root
            'site_rest_url'      => get_rest_url(), // Full site REST base URL for other endpoints
            'post_type'          => $post_type,    // type of post to fetch      
        );

        wp_localize_script(
            'act-posts-script',
            'actPostsData',
            $localized_data
        );
    }
}
// Helper function for file modification time (for cache busting)
if ( ! function_exists( 'file_time' ) ) {
    function file_time( $file ) {
        return file_exists( $file ) ? filemtime( $file ) : false;
    }
}
new ACT_Posts_Plugin();

<?php
/**
 * Plugin Name: ACT Posts Plugin
 * Plugin URI:  https://sites.stringerhj.co.uk/ACT/WP_plugins/ACT_posts/html/ACT_posts.html
 * Description: A custom plugin to display posts in a responsive grid with infinite scroll and filtering.
 * Version:     1.0.0
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

/**
 * Main ACT_Posts_Plugin Class.
 */
class ACT_Posts_Plugin {

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
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
    }

    /**
     * Register the [act_posts] shortcode.
     */
    public function register_shortcode() {
        add_shortcode( 'act_posts', array( $this, 'render_posts_grid_shortcode' ) );
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

        // Parse shortcode attributes (e.g., to set default category, sort options, excerpt length)
        $atts = shortcode_atts( array(
            'category' => '', // ID or slug
            'sort_by'     => 'date', // 'date', 'author'
            'sort_order'  => 'desc', // 'asc', 'desc'
            'excerpt_length'      => 150, // Default character limit for fallback excerpt
            'show_category_filter' => 'false', // 'true' or 'false'
            'show_sort_controls'   => 'false', // 'true' or 'false'
            'posts_per_page'       => 20, // Allow shortcode to override global default
        ), $atts, 'act_posts_grid' );

        // Convert boolean strings to actual booleans
        $show_category_filter = filter_var( $atts['show_category_filter'], FILTER_VALIDATE_BOOLEAN );
        $show_sort_controls   = filter_var( $atts['show_sort_controls'], FILTER_VALIDATE_BOOLEAN );

        // Determine the initial category ID for the REST API
        $initial_category_id = '';
        if ( ! empty( $atts['category'] ) ) {
            // Try to get term by ID (if it's a number)
            if ( is_numeric( $atts['category'] ) ) {
                $term = get_term_by( 'id', (int) $atts['category'], 'category' );
            } else {
                // Otherwise, try by slug or name
                $term = get_term_by( 'slug', $atts['category'], 'category' );
                if ( ! $term ) {
                    $term = get_term_by( 'name', $atts['category'], 'category' );
                }
            }

            if ( $term && ! is_wp_error( $term ) ) {
                $initial_category_id = $term->term_id;
            }
        }
        // Store the determined attributes in the class property to be accessible by enqueue_scripts
        $this->current_shortcode_atts = array(
            'initial_category_id'  => $initial_category_id,
            'initial_sort_by'      => $atts['sort_by'],
            'initial_sort_order'   => $atts['sort_order'],
            'excerpt_length'       => $atts['excerpt_length'],
            'posts_per_page'       => $atts['posts_per_page'],
            'show_category_filter' => $show_category_filter, // Pass boolean
            'show_sort_controls'   => $show_sort_controls,   // Pass boolean
        );

        ob_start(); // Start output buffering

        ?>
        <div class="act-posts-grid-wrapper">

            <div class="act-posts-grid-controls">
                <?php if ( $show_category_filter ) : ?>
                    <div class="act-posts-category-filter">
                        <label for="act-posts-category-select"><?php esc_html_e( 'Filter by Category:', 'act-posts' ); ?></label>
                        <select id="act-posts-category-select">
                            <option value=""><?php esc_html_e( 'All Categories', 'act-posts' ); ?></option>
                            <?php
                            // Get all categories
                            $categories = get_categories( array(
                                'hide_empty' => true, // Only show categories with posts
                            ) );
                            foreach ( $categories as $category_obj ) {
                                $selected = selected( $initial_category_id, $category_obj->term_id, false ); // Use $initial_category_id
                                echo '<option value="' . esc_attr( $category_obj->term_id ) . '" ' . $selected . '>' . esc_html( $category_obj->name ) . '</option>';
                            }
                            ?>
                        </select>
                    </div><?php endif; ?>

                <?php if ( $show_sort_controls ) : ?>
                    <div class="act-posts-sort-controls">
                        <label for="act-posts-sort-select"><?php esc_html_e( 'Sort by:', 'act-posts' ); ?></label>
                        <select id="act-posts-sort-select">
                            <option value="date_desc" <?php selected( $atts['default_sort_by'] === 'date' && $atts['default_sort_order'] === 'desc' ); ?>><?php esc_html_e( 'Most Recent', 'act-posts' ); ?></option>
                            <option value="date_asc" <?php selected( $atts['default_sort_by'] === 'date' && $atts['default_sort_order'] === 'asc' ); ?>><?php esc_html_e( 'Least Recent', 'act-posts' ); ?></option>
                            <option value="author_asc" <?php selected( $atts['default_sort_by'] === 'author' && $atts['default_sort_order'] === 'asc' ); ?>><?php esc_html_e( 'Author (A-Z)', 'act-posts' ); ?></option>
                            <option value="author_desc" <?php selected( $atts['default_sort_by'] === 'author' && $atts['default_sort_order'] === 'desc' ); ?>><?php esc_html_e( 'Author (Z-A)', 'act-posts' ); ?></option>
                        </select>
                    </div><?php endif; ?>
            </div><div id="act-posts-grid-container" class="act-posts-grid-container">
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
    public function enqueue_scripts() {
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
        $atts = $this->current_shortcode_atts;

        // Default values for actPostsData if shortcode wasn't rendered on the page,
        // or if it was, use the values stored in $this->current_shortcode_atts
        $localized_data = array(
            'rest_url'           => get_rest_url() . 'wp/v2/posts',
            'nonce'              => wp_create_nonce( 'wp_rest' ), // For future authenticated requests if needed
            'posts_per_page'     => isset( $atts['posts_per_page'] ) ? (int) $atts['posts_per_page'] : 20,
            'initial_category_id'=> isset( $atts['initial_category_id'] ) ? $atts['initial_category_id'] : '',
            'initial_sort_by'    => isset( $atts['initial_sort_by'] ) ? $atts['initial_sort_by'] : 'date',
            'initial_sort_order' => isset( $atts['initial_sort_order'] ) ? $atts['initial_sort_order'] : 'desc',
            'excerpt_length'     => isset( $atts['excerpt_length'] ) ? (int) $atts['excerpt_length'] : 150,
            'show_category_filter' => isset( $atts['show_category_filter'] ) ? $atts['show_category_filter'] : false,
            'show_sort_controls'   => isset( $atts['show_sort_controls'] ) ? $atts['show_sort_controls'] : false,
            'home_url'           => home_url(), // Useful for relative URLs or site root
        );

        wp_localize_script(
            'act-posts-script',
            'actPostsData',
            $localized_data
        );
    }
}
new ACT_Posts_Plugin();

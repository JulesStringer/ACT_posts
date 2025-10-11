<?php
/**
 * Plugin Name: ACT Posts Plugin
 * Plugin URI:  https://sites.stringerhj.co.uk/ACT/WP_plugins/ACT_posts/html/ACT_posts.html
 * Description: A custom plugin to display posts in a responsive grid with infinite scroll and filtering.
 * Version:     1.1.1
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
        $this->register_ajax_actions(); // <-- Add this line
    }

    /**
     * Register the [act_posts] shortcode.
     */
    public function register_shortcode() {
        add_shortcode( 'act_posts', array( $this, 'render_act_posts_grid_shortcode' ) );
    }
    /**
     * Executes a specific SQL query to get a count of published posts per category.
     *
     * @return array An associative array where keys are category IDs and values are post counts.
     */
    private function get_category_post_counts_lookup() {
        global $wpdb;

        $query = 
            "
            SELECT
                t.term_id AS category_id,
                COUNT(p.ID) AS post_count
            FROM
                {$wpdb->prefix}terms AS t
            JOIN
                {$wpdb->prefix}term_taxonomy AS tt ON t.term_id = tt.term_id
            JOIN
                {$wpdb->prefix}term_relationships AS tr ON tt.term_taxonomy_id = tr.term_taxonomy_id
            JOIN
                {$wpdb->prefix}posts AS p ON tr.object_id = p.ID
            WHERE
                tt.taxonomy = 'category'
                AND p.post_status = 'publish'
            GROUP BY
                t.name
            ORDER BY
                post_count DESC
            ";

        $results = $wpdb->get_results($query, ARRAY_A);

        $category_counts = [];
        if (!empty($results)) {
            foreach ($results as $row) {
                $category_counts[$row['category_id']] = (int) $row['post_count'];
            }
        }

        return $category_counts;
    }
    private function get_post_count(){
        global $wpdb;
        $query = "SELECT COUNT(*) AS POST_COUNT FROM {$wpdb->prefix}posts where post_type = 'post' AND post_status = 'publish'";
        $result = $wpdb->get_row($query, ARRAY_A);
        return (int) $result['POST_COUNT'];        
    }
    private function get_posts_select_list(){
        global $wpdb;
        $query = "SELECT p.ID, p.post_date, p.post_author,GROUP_CONCAT(t.term_id) AS category_ids
            FROM {$wpdb->prefix}posts p
            LEFT JOIN {$wpdb->prefix}term_relationships tr ON tr.object_id = p.ID
            LEFT JOIN {$wpdb->prefix}term_taxonomy t ON t.term_taxonomy_id = tr.term_taxonomy_id AND t.taxonomy = 'category'
            WHERE p.post_status = 'publish' AND p.post_type = 'post'
            GROUP BY p.ID, p.post_date, p.post_author
            ORDER BY p.post_date DESC";
        $results = $wpdb->get_results($query, ARRAY_A);
        $select_list = [];
        if ( !empty($results)){
            foreach($results as $row){
                $select_list[] = array(
                    'id' => (int) $row['ID'],
                    'date' => $row['post_date'],
                    'author' => (int) $row['post_author'],
                    'categories' => !empty($row['category_ids']) ? array_map('intval', explode(',', $row['category_ids'])) : array(),
                );
            }
        }
        return $select_list;
    }
    private function get_event_select_list(){
        global $wpdb;
        $query = "SELECT p.ID, 
	(SELECT m.meta_value FROM `{$wpdb->prefix}postmeta` AS m where m.meta_key = 'from' AND m.post_id = p.ID) AS from_date,
    (SELECT m.meta_value FROM `{$wpdb->prefix}postmeta` AS m where m.meta_key = 'to' AND m.post_id = p.ID) AS to_date,
	(SELECT m.meta_value FROM `{$wpdb->prefix}postmeta` AS m where m.meta_key = 'classification' AND m.post_id = p.ID) AS classification,
	(SELECT m.meta_value FROM `{$wpdb->prefix}postmeta` AS m where m.meta_key = 'interval_type' AND m.post_id = p.ID) AS interval_type,
	(SELECT m.meta_value FROM `{$wpdb->prefix}postmeta` AS m where m.meta_key = 'interval_end' AND m.post_id = p.ID) AS interval_end,
	(SELECT m.meta_value FROM `{$wpdb->prefix}postmeta` AS m where m.meta_key = 'interval_value' AND m.post_id = p.ID) AS interval_value
	FROM {$wpdb->prefix}posts AS p
    WHERE p.post_type = 'event'";
        $results = $wpdb->get_results($query, ARRAY_A);
        $select_list = [];
        if ( !empty($results)){
            foreach($results as $row){
                $select_list[] = array(
                    'id' => (int) $row['ID'],
                    'from_date' => $row['from_date'],
                    'to_date' => $row['to_date'],
                    'classification' => $row['classification'],
                    'interval_type' => $row['interval_type'],
                    'interval_end' => $row['interval_end'],
                    'interval_value' => $row['interval_value']
                );
            }
        }
        return $select_list;
    }
    private function get_team_select_list(){
        global $wpdb;
        $query = "SELECT p.ID, p.post_date, p.post_author
            FROM {$wpdb->prefix}posts p
            WHERE p.post_status = 'publish' AND p.post_type = 'team'
            ORDER BY p.post_date DESC";
        $results = $wpdb->get_results($query, ARRAY_A);
        $select_list = [];
        if ( !empty($results)){
            foreach($results as $row){
                $select_list[] = array(
                    'id' => (int) $row['ID'],
                    'date' => $row['post_date'],
                    'author' => (int) $row['post_author']
                );
            }
        }
        return $select_list;
    }
    private function get_acf_groups_by_post_type( $post_type_slug ) {
        $matching_groups = array();
        
        // 1. Get all field groups in the system
        $all_groups = acf_get_field_groups();

        // 2. Loop through each field group
        foreach ( $all_groups as $group ) {
            // A field group can have multiple "rule groups" (OR logic)
            foreach ( $group['location'] as $rule_group ) {
                // A rule group can have multiple "rules" (AND logic)
                foreach ( $rule_group as $rule ) {
                    
                    // 3. Check for the specific CPT rule
                    if ( 
                        $rule['param']    === 'post_type' && 
                        $rule['operator'] === '==' && 
                        $rule['value']    === $post_type_slug 
                    ) {
                        // Rule found! Add the whole field group array to our results
                        $matching_groups[] = $group;
                        // Move to the next field group
                        continue 3; 
                    }
                }
            }
        }
        return $matching_groups;
    }
    private function get_acf_select_fields_by_post_type( $post_type ){
       $field_groups = $this->get_acf_groups_by_post_type($post_type);
        //error_log('Field groups matching ' . $post_type. ' : ' . var_export($field_groups, true));
        $select_fields = [];
        if ( ! empty( $field_groups ) ) {
            $first_group_key = $field_groups[0]['key'];
            //error_log('first_group_key '. $first_group_key);
            $fields_in_group = acf_get_fields( $first_group_key );
            foreach($fields_in_group as $field){
                if ( $field['type'] === 'select'){
                    $select_fields[] = $field;
                }
            }
        }
        return $select_fields;
    }
    private function get_custom_select_list($post_type){
        global $wpdb;
        $select_fields = $this->get_acf_select_fields_by_post_type( $post_type );
        $clean_post_type = esc_sql($post_type);
        $query = "SELECT p.ID ";
            $joins = "";
    
        if ( count($select_fields) > 0 ){
            $counter = 1;
            foreach($select_fields as $field){
                $field_name = esc_sql($field['name']);
                $alias = "s{$counter}";
                
                // Add column to SELECT
                $query .= ", {$alias}.meta_value AS `{$field_name}`";

                // Add INNER JOIN for the postmeta table
                $joins .= " INNER JOIN {$wpdb->prefix}postmeta AS {$alias} 
                            ON p.ID = {$alias}.post_id 
                            AND {$alias}.meta_key = '{$field_name}'";
                $counter++;
            }
        }

        $query .= " FROM {$wpdb->prefix}posts p";
        $query .= $joins;
        $query .= " WHERE p.post_status = 'publish' AND p.post_type = '".$post_type."'";
        $results = $wpdb->get_results($query, ARRAY_A);
        $select_list = [];
        if ( !empty($results)){
            foreach($results as $row){
                $item = array('id' => (int) $row['ID']);
                if ( count($select_fields) > 0 ){
                    foreach($select_fields as $field){
                        $field_name = $field['name'];
                        $raw_value = isset($row[$field_name]) ? $row[$field_name] : '';
                        if ( is_serialized($raw_value) ){
                            $item[$field_name] = unserialize($raw_value);
                        } else {
                            $item[$field_name] = $raw_value;
                        }
                    }
                }
                $select_list[] = $item;
            }
        }
        return $select_list;
    }
    private function get_select_list($post_type){
        switch($post_type){
            case 'posts':
                return $this->get_posts_select_list();
            case 'event':
                return $this->get_event_select_list();
            case 'team':
                return $this->get_team_select_list();
            default:
                return $this->get_custom_select_list($post_type);
        }
    }
    private function search_posts($search_term){
        global $wpdb;
        if ( empty($search_term) ){
            return null;
        }
        // Support for quoted "exact phrase" search and multi-word search
        $search_term = stripslashes($search_term);
        $search_term = trim($search_term);
        $exact_search = '';
        if (
            (substr($search_term, 0, 1) === '"' && substr($search_term, -1) === '"') ||
            (substr($search_term, 0, 1) === "'" && substr($search_term, -1) === "'")
        ) {
            $exact_search = strtolower(substr($search_term, 1, -1));
        }

        $where_sql = '';
        $where_args = array();

        if (!empty($exact_search)) {
            // Exact phrase search in title or content
            $like_term = '%' . $wpdb->esc_like($exact_search) . '%';
            $where_sql = "(LOWER(p.post_title) LIKE %s OR LOWER(p.post_content) LIKE %s)";
            $where_args[] = $like_term;
            $where_args[] = $like_term;
        } else {
            // Multi-word search: match any word in title or content
            $search_words = preg_split('/\s+/', $search_term);
            $where_clauses = array();
            foreach ($search_words as $word) {
                $word = strtolower($word);
                $like_word = '%' . $wpdb->esc_like($word) . '%';
                $where_clauses[] = "(LOWER(p.post_title) LIKE %s OR LOWER(p.post_content) LIKE %s)";
                $where_args[] = $like_word;
                $where_args[] = $like_word;
            }
            $where_sql = implode(' OR ', $where_clauses);
        }
        $query = $wpdb->prepare(
            "SELECT p.ID, p.post_date, p.post_author, GROUP_CONCAT(t.term_id) AS category_ids
            FROM {$wpdb->prefix}posts p
            LEFT JOIN {$wpdb->prefix}term_relationships tr ON tr.object_id = p.ID
            LEFT JOIN {$wpdb->prefix}term_taxonomy t ON t.term_taxonomy_id = tr.term_taxonomy_id AND t.taxonomy = 'category'
            WHERE p.post_status = 'publish' 
            AND p.post_type = 'post'
            AND ($where_sql)
            GROUP BY p.ID, p.post_date, p.post_author
            ORDER BY p.post_date DESC",
            ...$where_args
        );
        $results = $wpdb->get_results($query, ARRAY_A);
        $select_list = null;
        if ( !empty($results)){
            foreach($results as $row){
                $select_list[] = array(
                    'id' => (int) $row['ID'],
                    'date' => $row['post_date'],
                    'author' => (int) $row['post_author'],
                    'categories' => !empty($row['category_ids']) ? array_map('intval', explode(',', $row['category_ids'])) : array(),
                );
            }
        }
        return $select_list;
    }
    /**
     * AJAX handler for searching posts.
     */
    public function ajax_search_posts() {
        error_log('ajax_search_posts called');
        // Check nonce for security
        check_ajax_referer( 'act_posts_action', 'nonce' );

        // Get the search term from the AJAX request
        $search_term = isset($_POST['search']) ? sanitize_text_field($_POST['search']) : '';
error_log('Search term: ' . $search_term);
        // Call the search_posts method
        $results = $this->search_posts($search_term);
if ( $results === null ){
    error_log('Search returned null (no search term)');
} else {
    error_log('Search returned ' . count($results) . ' results');
}
        // Return JSON response
        wp_send_json_success($results);
    }

    /**
     * Register AJAX actions for search_posts.
     */
    public function register_ajax_actions() {
        add_action('wp_ajax_act_posts_search', array($this, 'ajax_search_posts'));
        add_action('wp_ajax_nopriv_act_posts_search', array($this, 'ajax_search_posts'));
    }
    private function show_post_controls($initial_category_ids, $categories, $sortby, $sortorder){
        $category_counts = $this->get_category_post_counts_lookup();
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
                            (<span class="act-posts-category-count" data-term-id="all"><?php echo $this->get_post_count(); ?></span>)
                        </option>
                        <?php
                            foreach ( $categories as $category_obj ) {
                                $selected = '';
                                if ( !empty($initial_category_ids) ){
                                    foreach( $initial_category_ids as $initial_category_id ) {
                                        if ( selected( $initial_category_id, $category_obj->term_id, false )){
                                            $selected = 'selected';
                                        }
                                    }
                                }
                                echo '<option value="' . esc_attr( $category_obj->term_id ) . '" ' . $selected . '>' 
                                . esc_html( $category_obj->name ) 
                                . ' (<span class="act-posts-category-count" data-term-id="' . esc_attr($category_obj->term_id) . '">' .
                                 ( isset($category_counts[$category_obj->term_id]) ? $category_counts[$category_obj->term_id] : 0 ) 
                                . '</span>)</option>';
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
        </table>
        <?php 
    }
    /**
     * Renders the controls for filtering 'event' post types (date/time picker).
     *
     * @param string $initial_window_start_html The initial start date/time for the HTML input.
     * @param string $prompt - events from prompt
     */
    private function show_event_controls( $initial_window_start_html, $prompt) {
        ?>
        <div class="act-event-controls">
            <div class="date-time-filter">
                <label for="event-window-start"><?php esc_html_e( $prompt, 'act-posts' ); ?></label>
                <input type="datetime-local" id="event-window-start"
                       value="<?php echo esc_attr( $initial_window_start_html ); ?>">
            </div>
        </div>
        <?php
    }
    /**
     * Renders the controls for filtering custom post types from custom fields of type select
     * 
     * @param $post_type post type from which field group is derived, and thus fields with type select
     */
    private function show_custom_controls($post_type){
        // get any custom fields for post_type - doco says not reliable
        //error_log('Fields in group: '. var_export($fields_in_group, true));
        $select_fields = $this->get_acf_select_fields_by_post_type($post_type);
        if ( count($select_fields) > 0){
            echo '<table class="act-custom-controls">';
            foreach($select_fields as $field){
                error_log('field with type select: '. var_export($field, true));
                $prompt = $field['label'];
                echo '<tr class="'.$name.'-filter" >';
                echo '<td><label for="'.$name.'" >'.$prompt.'</label></td>';
                $name = $field['name'];
                $choices = $field['choices'];
                echo '<td><select id="'.$name.'" class="custom-filter-select" ';
                if ( $field['multiple'] ){
                    echo ' multiple size="6" ';
                }
                echo '>';
                echo '<option value="" selected>All'
                 . ' (<span class="act-posts-category-count" select-id="all"></span>)</option>';
                foreach( $choices as $value => $label ) {
                    $clean_value = esc_attr($value);
                    echo '<option value="' . $clean_value . '">' . esc_html($label)
                      . ' (<span class="act-posts-category-count" select-id="'. $clean_value . '"></span>)</option>';
                }
                echo "</select></td>";
                echo "</tr>";
            }
            echo "</table>";
        }
    }
    private function output_post_grid(){
        ?>
            <div id="act-posts-grid-container" class="act-posts-grid-container">
            </div>

            <div id="act-posts-more" class="act-posts-more" style="display: none;">
                <button id="act-posts-load-more-button" class="act-posts-load-more-button">
                    <?php esc_html_e( 'Load More Posts', 'act-posts' ); ?>
                </button>
            </div>
            <div id="act-posts-infinite-scroll-trigger" class="act-posts-infinite-scroll-trigger"></div>

            <div id="act-posts-loading-spinner" class="act-posts-loading-spinner" style="display: none;">
                <p><?php esc_html_e( 'Loading more posts...', 'act-posts' ); ?></p>
            </div>

            <div id="act-posts-no-results" class="act-posts-no-results" style="display: none;">
                <p><?php esc_html_e( 'No posts found matching your criteria.', 'act-posts' ); ?></p>
            </div>

        </div><?php
    }
    private function render_event_grid_shortcode( $atts ) {
        // Placeholder for future event-specific shortcode rendering
        // --- Determine initial date window for 'event' post type ---
        //$initial_window_start = new DateTime(); // Default to current time
        $initial_window_start = new DateTime('now', new DateTimeZone(wp_timezone_string())); // Explicitly set to site's local time
        // Parse shortcode attributes (e.g., to set default category, sort options, excerpt length)
        $atts = shortcode_atts( array(
            'sort_by'         => 'date', // 'date', 'author'
            'sort_order'      => 'desc', // 'asc', 'desc'
            'excerpt_length'  => 150, // Default character limit for fallback excerpt
            //'posts_per_page'  => 100, // Allow shortcode to override global default
            'post_type'       => 'event',      // rest api schema to fetch
            'has_controls'    => 'yes',  // determines if controls are displayed
            // New attributes for 'event' post type:
            'window_start'    => '',          // Initial window start datetime (e.g., 'now', '2025-01-01 00:00:00')
            'prompt'          => 'Events from:'
        ), $atts, 'act_posts' );

        $prompt = $atts['prompt'];
        // If window_start is provided in shortcode or URL
        if ( ! empty( $_GET['window_start'] ) ) {
            $initial_window_start = new DateTime( sanitize_text_field( $_GET['window_start'] ) );
        } elseif ( ! empty( $atts['window_start'] ) && $atts['window_start'] !== 'now' ) {
            $initial_window_start = new DateTime( sanitize_text_field( $atts['window_start'] ) );
        }
        // Store the determined attributes in the class property to be accessible by enqueue_scripts
        $this->current_shortcode_atts = array(
            'initial_sort_by'      => $atts['sort_by'],
            'initial_sort_order'   => $atts['sort_order'],
            'excerpt_length'       => $atts['excerpt_length'],
            //'posts_per_page'       => $atts['posts_per_page'],
            'post_type'            => 'event',
            'initial_window_start' => $initial_window_start->format( DateTime::ATOM ),
        );
        $this->enqueue_scripts($this->current_shortcode_atts);
        ob_start(); // Start output buffering
            ?>
            <div class="act-posts-grid-wrapper">
                <?php
        if ( $atts['has_controls'] === 'yes'){
            // Call the new function for event controls
            $this->show_event_controls(
                $initial_window_start->format( 'Y-m-d\TH:i' ), // HTML datetime-local format
                $prompt,
            );
        }
        $this->output_post_grid();
        return ob_get_clean(); // Return the buffered HTML
    }
    private function render_team_grid_shortcode( $atts ) {
        // Placeholder for future team-specific shortcode rendering
        $atts = shortcode_atts( array(
            'sort_by'         => 'date', // 'date', 'author'
            'sort_order'      => 'desc', // 'asc', 'desc'
            'excerpt_length'  => 150, // Default character limit for fallback excerpt
            'post_type'       => 'team',      // rest api schema to fetch
            'has_controls'    => 'no',  // determines if controls are displayed
        ), $atts, 'act_posts' );
        // Store the determined attributes in the class property to be accessible by enqueue_scripts
        $this->current_shortcode_atts = array(
            'initial_sort_by'      => $atts['sort_by'],
            'initial_sort_order'   => $atts['sort_order'],
            'excerpt_length'       => $atts['excerpt_length'],
            'post_type'            => 'team',
        );
        $this->enqueue_scripts($this->current_shortcode_atts);
        ob_start(); // Start output buffering
            ?>
            <div class="act-posts-grid-wrapper">
                <?php
        if ( $atts['has_controls'] === 'yes'){
                // Get list of custom post fields
            $this->show_custom_controls($post_type);
        }
        $this->output_post_grid();
        return ob_get_clean(); // Return the buffered HTML
    }
    private function render_custom_grid_shortcode( $post_type, $atts ) {
        // Placeholder for future custom post type-specific shortcode rendering
        // Parse shortcode attributes (e.g., to set default category, sort options, excerpt length)
        $default_atts = array(
            'excerpt_length'  => 150, // Default character limit for fallback excerpt
            //'posts_per_page'  => 100, // Allow shortcode to override global default
            'post_type'       => $post_type,      // rest api schema to fetch
            'has_controls'    => 'yes',  // determines if controls are displayed
        );
        $fields = $this->get_acf_select_fields_by_post_type($post_type);
        if ( count($fields) > 0 ){
            $default_atts['has_controls'] = 'yes';
            foreach($fields as $field){
                $name = $field['name'];
                $default_atts[$name] = ''; // default to no filter
            }
        } else {
            $default_atts['has_controls'] = 'no';
        }
        $atts = shortcode_atts( $default_atts, $atts, 'act_posts' );

        $initial_values = array();
        foreach($fields as $field){
            $name = $field['name'];
            if ( ! empty( $_GET[$name] ) ) {
                // Ensure $_GET value is always an array
                $url_values = is_array( $_GET[$name] ) ? $_GET[$name] : explode( ',', $_GET[$name] );
                $initial_values[$name] = array_map( 'sanitize_text_field', $url_values );
            } elseif ( ! empty( $atts[$name] ) ) {
                $shortcode_values = explode( ',', $atts[$name] );
                $shortcode_values = array_map( 'urldecode', $shortcode_values ); 
                $initial_values[$name] = array_map( 'trim', $shortcode_values );
            } else {
                $initial_values[$name] = array(); // No filter
            }
        }
        // Store the determined attributes in the class property to be accessible by enqueue_scripts
        $this->current_shortcode_atts = array(
            'initial_sort_by'      => $atts['sort_by'],
            'initial_sort_order'   => $atts['sort_order'],
            'excerpt_length'       => $atts['excerpt_length'],
            'post_type'            => $post_type,
            'initial_values'       => $initial_values,
        );
        $this->enqueue_scripts($this->current_shortcode_atts);
        ob_start(); // Start output buffering
            ?>
            <div class="act-posts-grid-wrapper">
                <?php
        if ( $atts['has_controls'] === 'yes'){
            // Get list of custom post fields
            $this->show_custom_controls($post_type);
        }
        $this->output_post_grid();
        return ob_get_clean(); // Return the buffered HTML
    }
    private function render_posts_grid_shortcode( $atts ) {
        // Placeholder for future posts-specific shortcode rendering
        // Parse shortcode attributes (e.g., to set default category, sort options, excerpt length)
        $atts = shortcode_atts( array(
            'category'        => '', // ID, slug, or comma-separated list for initial shortcode filter
            'sort_by'         => 'date', // 'date', 'author'
            'sort_order'      => 'desc', // 'asc', 'desc'
            'excerpt_length'  => 150, // Default character limit for fallback excerpt
            //'posts_per_page'  => 100, // Allow shortcode to override global default
            'post_type'       => 'posts',      // rest api schema to fetch
            'has_controls'    => 'yes',  // determines if controls are displayed
        ), $atts, 'act_posts' );

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
            'post_type'            => $posts,
        );
        $this->enqueue_scripts($this->current_shortcode_atts);
        ob_start(); // Start output buffering
            ?>
            <div class="act-posts-grid-wrapper">
                <?php
        if ( $atts['has_controls'] === 'yes'){
                // Get all categories
                $categories = get_categories( array(
                    'hide_empty' => true, // Only show categories with posts
                ) );
                $this->show_post_controls($initial_category_ids, $categories, $atts['sort_by'], $atts['sort_order']);            
        }
        $this->output_post_grid();
        return ob_get_clean(); // Return the buffered HTML
    }
    /**
     * Render the HTML for the posts grid.
     * This function should only output the container and controls.
     * Actual post fetching and rendering will be done via JavaScript/REST API.
     *
     * @param array $atts Shortcode attributes.
     * @return string HTML output.
     */
    public function render_act_posts_grid_shortcode( $atts ) {

        if ( ! isset( $atts['post_type'] ) ) {
            $atts['post_type'] = 'posts'; // Default to 'posts' if not specified
        }
        $post_type = sanitize_key( $atts['post_type'] ); // Sanitize post type
        switch ( $post_type ) {
            case 'event':
                return $this->render_event_grid_shortcode( $atts );
            case 'team':
                return $this->render_team_grid_shortcode( $atts );
            case 'posts':
                return $this->render_posts_grid_shortcode( $atts );
            default:
                return $this->render_custom_grid_shortcode( $post_type, $atts );
        }
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
        $select_list = $this->get_select_list($post_type);
        error_log('select_list count: ' . count($select_list) );
        $localized_data = array(
            'rest_url'           => get_rest_url() . 'wp/v2/' . $post_type,
            'nonce'              => wp_create_nonce( 'act_posts_action' ), // For future authenticated requests if needed
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
            'initial_values'      => isset( $atts['initial_values'] ) ? $atts['initial_values'] : array(),
            'home_url'           => home_url(), // Useful for relative URLs or site root
            'site_rest_url'      => get_rest_url(), // Full site REST base URL for other endpoints
            'post_type'          => $post_type,    // type of post to fetch     
            'select_list'        => $select_list,
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

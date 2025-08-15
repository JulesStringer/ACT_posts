# ACT Posts

This plugin provides a shortcode which can be configured to either:

+ Display all posts together with controls to:
+   + select which category is displayed (or All)
   + control the sort order by:
       + Date (newset first)
       + Date (oldest first)
       + Author

+ Display all posts relating to a preconfigured category in descending date order
+ Display custom post types, with special supports for:
   + Team members - without control panel
   + Events - with reference date

## Displaying posts for a single category
It is intended that each activity page will have a posts section for posts related to that category.
The appropriate category for the activity page should be set in the category argument.
The shortcode will then display all posts in that category in descending date order.
As this is the most common use case the default arguments are designed to match this case.
```
   [ACT_posts category="category-slug1,category-slug2"]
```

## Displaying all posts

This is the use case for the News page, which numerically is the less used case.
As category filter and sort order selections need to be shown on this page, these need to be specified as parameters.

```
   [act_posts]
```

## Selecting categories via the page url
One or more categories can be passed as a page parameter in the category= parameter on the command line,
            example:
```
  https://test.act.stringerhj.co.uk/news/?category=carbon-cutters,energy-and-built-environment
```
Here both the carbon-cutters and energy-and-built-environment categories will be selected</p>

### Current categories

[Current categories converted from legacy posts are shown in this spreadsheet](https://sites.stringerhj.co.uk/ACT/WP_plugins/category_mapping.xlsx) 

## Displaying custom post types
Custom post types can be used to display things like team members, events, FAQs and a host of other things.
at its simplest this is just a matter of setting the post_type attribute, as below for FAQs.
```
   [act_posts post_type=faq]
```
For some post_types the control panel that appears at the top of the page is irrelevant, and so should be removed, as is the case with team members
```
   [act_posts post_type=team has_controls=no]
```

## Events

Events are defined as a custom post type with attributes which handle date and other special handling. 
These are still handled as posts but have a different index which is date sorted and constructed relative to a reference date.
For events the control panel consists of the reference date. The shortcode for events is simply:
```
    [act_posts post_type=event]
```

## Full set of short code parameters

The full set of short code parameters are given in the following table:

|Parameter|Description|
|category|Category ID,slug, or name. Can also be a comma separated list of these|
|sort_by|Choice of field to sort by - options are date and author|
|sort_order|Choice of sort order (desc - descending, asc - ascending|
|excerpt_length|Default character limit for fallback excerpt|
|post_type|Defaults to posts, can be team, event or any custom post type which is handled like a post|
|has_controls|Determines if a control panel is displayed before the posts|
|window_start|Reference date for events (not normally set)|
|prompt|Prompt to appear before reference date (default Events from:)|

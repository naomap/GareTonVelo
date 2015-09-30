# GareTonVelo
Dynamic map showing bicycle parkings from OpenStreetMap

This dynamic web map was developed to show progress during a mapping party for bicycle parkings.

The bicycle parkings are retrieved from the OpenStretMap database using the Overpass API, within a bounding box. 
Statistics are displayed and markers are built differently for different scales ; at a large scale the markers 
show the type of bicycle_parking (stands, wall_loops and so on), their capacity and whether they're covered.
Incomplete parkings (no type or no capacity) are highlighted in red.

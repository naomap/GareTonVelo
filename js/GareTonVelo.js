/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var GareTonVelo = L.Class.extend(
{
    options: {
        overpassBaseUrl: "http://overpass-api.de/api/",
        bounds: {latmin:47.12, latmax:47.32, lonmin:-1.75, lonmax:-1.40},
        zoomNear: 16,
        zoomFar: 14
    },
    
    validTypes: ['stands', 'wide_stands', 'lockers', 'wall_loops', 'ground_slots'],
        
    initialize : function (divId, options) {

        L.setOptions(this, options);
        this.setupMap(divId);
        this.loadData();
    },
                
    setupMap : function (divId) {
        var osmLayer = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        });
        var mapquestLayer = L.tileLayer("http://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            subdomains: ["otile1", "otile2", "otile3", "otile4"],
                attribution: ' &copy; <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> |' +
                             ' &copy; <a href="http://osm.org/copyright" target="_blank">Contributeurs OpenStreetMap</a>'
        });
        var cycleLayer = L.tileLayer('http://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png', 
        {
            attribution: '&copy; <a href="http://www.opencyclemap.org">OpenCycleMap</a> |' +
                    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }); 
        
        this.map = L.map(divId, 
        {
            layers: [mapquestLayer],
            center: [47.215, -1.555],
            zoom: 12,
            zoomControl: false
        });
        
        this.map.addControl(new L.control.zoom({
            position: 'topleft',
            zoomInTitle: 'Zoom avant',
            zoomOutTitle: 'Zoom arrière'
        }));
        L.control.scale({imperial: false}).addTo(this.map);
        
        var layerControl = L.control.layers({
            "OpenStreetMap": osmLayer,
            "Mapquest": mapquestLayer,
            "OpenCycleMap" : cycleLayer
        });
        layerControl.addTo(this.map);
        
        if (this.options.bounds) {
            var bounds = this.checkBounds(this.options.bounds);
            this.addHomeControl(bounds);        
            this.map.fitBounds(bounds);
            this.map.zoomIn(); // Zoom in one level 
        }
    },
    
    addHomeControl : function(bounds) {

        // Ajoute une action pour revenir à l'emprise définie par {bounds}
        var _this = this;
        L.Control.homeControl = L.Control.extend({
            options: {
                position: 'topleft'
            },
            onAdd: function (map) {
                var container = L.DomUtil.create('div', 'home-control', map.getContainer());
                var butt = L.DomUtil.create('a', 'button', container);
                butt.href = '#';
                butt.title = 'Emprise initiale';
                var stop = L.DomEvent.stopPropagation;
                L.DomEvent.on(butt, 'click', stop)
                        .on(butt, 'mousedown', stop)
                        .on(butt, 'touchstart', stop)
                        .on(butt, 'mousewheel', stop)
                        .on(butt, 'MozMousePixelScroll', stop);
                L.DomEvent.on(butt, 'click', L.DomEvent.preventDefault);
                L.DomEvent.on(butt, 'click', function() {
                    _this.map.fitBounds(bounds);
                });

                return container;
            }
        });
        this.map.addControl(new L.Control.homeControl());
    },

    checkBounds : function(bounds) {
    
        // Retourne un objet L.LatLngBounds créé à partir de {bounds}
        if (bounds instanceof L.LatLngBounds) return bounds;

        if (L.Util.isArray(bounds)) {
            if (typeof bounds[0] === 'number' || typeof bounds[0] === 'string') {
                var southWest = L.latLng(bounds[0], bounds[1]),
                    northEast = L.latLng(bounds[2], bounds[3]);
                return L.latLngBounds(southWest, northEast);
            }
        }

        if (typeof bounds === 'object' && 'latmin' in bounds) {
            var southWest = L.latLng(bounds.latmin, bounds.lonmin ? bounds.lonmin : bounds.lngmin);
            var northEast = L.latLng(bounds.latmax, bounds.lonmax ? bounds.lonmax : bounds.lngmax);
            return L.latLngBounds(southWest, northEast);
        }

        return null;
    },
    
    loadData: function() {
        
        var _this = this;
        var bounds = this.checkBounds(this.options.bounds);
        var url = this.buildOverpassRequest(bounds);
        var request = new XMLHttpRequest();  // Not supported on IE < 10
        request.open("GET", url, true);
        this.map.spin(true);
        request.onload = function() {
            if (this.status === 200) {
                var response = JSON.parse(this.response);
                _this.displayOverpassResponse(response);
            } else {
                console.log("Une erreur s'est produite lors de la recherche !");
            }
            _this.map.spin(false);
        };
        request.send();
    },
        
    buildOverpassRequest : function(bbox) {

        var spatial = '(' + bbox.getSouth() + ',' + bbox.getWest() + ',' + bbox.getNorth() + ',' + bbox.getEast() + ')';
        var filter = '["amenity"="bicycle_parking"]';
        var query = 'node' + spatial + filter + ';out;';
        
        return this.options.overpassBaseUrl + 'interpreter?data=[out:json];' + query;
    },

    displayOverpassResponse : function(data) {
        
        var _this = this;
        
        this.buildMarkers(data);
        this.buildLayers();
        
        this.map.addLayer(this.layers.away);
        this.map.on('zoomend', function() {
            _this.checkVisibleLayer();
        });
        
        this.displayStats(this.getStatistics(data));
    },
    
    checkVisibleLayer: function () {
        
        var zoom = this.map.getZoom();

        if (zoom >= this.options.zoomNear && ! this.map.hasLayer(this.layers.near)) {
            this.map.removeLayer(this.layers.away);
            this.map.removeLayer(this.layers.far);
            this.map.addLayer(this.layers.near);
        } else if (zoom >= this.options.zoomFar && zoom < this.options.zoomNear && ! this.map.hasLayer(this.layers.far)) {
            this.map.removeLayer(this.layers.away);
            this.map.removeLayer(this.layers.near);
            this.map.addLayer(this.layers.far);
        } else if (zoom < this.options.zoomFar && ! this.map.hasLayer(this.layers.away)) {
            this.map.removeLayer(this.layers.far);
            this.map.removeLayer(this.layers.near);
            this.map.addLayer(this.layers.away);
        }
    },

    filterByType : function() {
        this.dropLayers();
        var parkingTypes = this.getFilter();
        this.buildLayers(parkingTypes);
        this.checkVisibleLayer();
    },
    
    getFilter : function() {
        var parkingTypes = [];
        var filters = document.getElementsByClassName("filter");
        for (var i = 0 ; i < filters.length; i++) {
            var filter = filters[i];
            if (filter.checked) {
                var values = filter.value.split(',');          
                parkingTypes = parkingTypes.concat(values);
            }
        }
        return parkingTypes;
    },

    dropLayers : function() {
        this.map.removeLayer(this.layers.away);
        this.map.removeLayer(this.layers.far);
        this.map.removeLayer(this.layers.near);
    },
    
    buildLayers : function(parkingTypes) {
        
        this.layers = {
            near : L.featureGroup(),
            far  : L.featureGroup(),
            away : L.featureGroup()
        };
        for (var i = 0 ; i < this.data.length ; i++) {
            var item = this.data[i];
            
            // Filter out unwanted types
            if (parkingTypes && parkingTypes.indexOf(item.type) === -1) continue;
            
            this.layers.near.addLayer(item.near);
            this.layers.far.addLayer(item.far);
            this.layers.away.addLayer(item.away);
        }
    },
    
    buildMarkers : function(data) {
        
        this.data = [];
        
        var iconFar = L.icon({
            iconUrl: "img/bicycle.png",
            iconSize: [21, 22],
            iconAnchor: [11, 21]
        });
        var iconFarRed = L.icon({
            iconUrl: "img/bicycle_red.png",
            iconSize: [21, 22],
            iconAnchor: [11, 21]
        });
        
        for (var i = 0 ; i < data.elements.length ; i++) {
            var elt = data.elements[i];
            if (elt.type === "node") {
                var latLng = L.latLng(elt.lat, elt.lon);
                
                var tags = elt.tags;
                var type = tags.bicycle_parking;
                var incomplete = ! tags.capacity;
                if (! type) {
                    type = "notype";
                    incomplete = true;
                } else if (this.validTypes.indexOf(type) === -1) {
                    type = "other";
                }
              
                var tooltip = this.parkingDescription(tags);
                var markerNear = new L.marker(latLng, {
                    icon: new ParkingIcon({tags: tags}),
                    title: tooltip
                });
                var markerFar = new L.marker(latLng, {
                    icon: (incomplete ? iconFarRed : iconFar),
                    title: tooltip
                });
                var markerAway = new L.circleMarker(latLng, {
                    fillColor: (incomplete ? '#FF0000' : '#3E82C7'),
                    fillOpacity: 1.0,
                    color: '#000',
                    weight: 1,
                    clickable: false
                });
                markerAway.setRadius(3);
                
                var item = { 
                    type : type,
                    near : markerNear,
                    far  : markerFar,
                    away : markerAway
                };
                this.data.push(item);             
            }
        }
    },
    
    parkingDescription : function(tags) {
        
        var desc = '';
        if (! tags.bicycle_parking) {
            desc += 'Type inconnu';
        } else {
            switch (tags.bicycle_parking) {
                case 'stands' :
                case 'wide_stands' :
                    desc += 'Appuis-vélos';
                    break;
                case 'lockers' :
                    desc += 'Casiers à vélo';
                    break;
                case 'wall_loops' :
                case 'ground_slots' :
                    desc += 'Pinces-roues';
                    break;
                default :
                    desc += 'Type ' + tags.bicycle_parking;
            }
        }
        
        if (tags.capacity) {
            desc += ', ' + tags.capacity + ' places';
        } else {
            desc += ', nombre inconnu';
        }
        
        if (tags.covered === 'yes') desc += ', couvert';
        
        return desc;
    },

    getStatistics : function(data) {

        var stats = {
            numSites: 0,
            numPlaces: 0,
            numCouverts: 0,
            noCapacity: 0,
            noType: 0,
            numAppuis: 0,
            numCasiers: 0,
            numPinces: 0,
            numAutres: 0,
            numNoType: 0
        };

        for (var i = 0 ; i < data.elements.length ; i++) {
            var elt = data.elements[i];
            if (elt.type === "node") {
                stats.numSites++;
                var tags = elt.tags;
                if (tags.capacity) {
                    
                    var capacity = parseInt(tags.capacity);
                    if (isNaN(capacity)) continue;
                    
                    stats.numPlaces += capacity;
                    if (tags.covered === "yes") stats.numCouverts += capacity;
                    
                    var type = tags.bicycle_parking;
                    if (! type) {
                        stats.noType++;
                        stats.numNoType += capacity;
                    } else switch(type) {
                        case 'lockers' :
                            stats.numCasiers += capacity;
                            break;
                        case 'stands' :
                        case 'wide_stands' :
                            stats.numAppuis += capacity;
                            break;
                        case 'wall_loops' :
                        case 'ground_slots' :
                            stats.numPinces += capacity;
                            break;
                        default :
                            stats.numAutres += capacity;
                    }
                } else {
                    stats.noCapacity++;
                }
            }
        }
        return stats;
    },
        
    displayStats : function(stats) {
        
        for (var type in stats) {
            var value = stats[type];
            
            var div = document.getElementById(type);
            var item = document.createElement("span");
            item.innerHTML = value;
            div.appendChild(item);
        }
    }
});

var ParkingIcon = L.Icon.extend({
    options: {
        shadowUrl: null,
        iconSize: new L.Point(32, 37),
	iconAnchor: new L.Point(16, 36),
	className: 'leaflet-div-icon'
    },

    createIcon: function () {
        var tags = this.options['tags'];
        var iconUrl = this.getIconUrl(tags);
        
	var div = document.createElement('div');
	var img = this._createImg(iconUrl);
	this._setIconStyles(div, 'icon');
        
        var capacity = tags.capacity;
        var numdiv = document.createElement('div');
        if (capacity) {
            numdiv.setAttribute ( "class", "number" );
            numdiv.innerHTML = capacity;
        } else {
            numdiv.setAttribute ( "class", "missing_number" );
            numdiv.innerHTML = "XX";
        }
        div.appendChild ( img );
        div.appendChild ( numdiv );
        
	return div;
    },
    
    getIconUrl: function(tags) {
        var iconName = "parking";
        if (! tags.bicycle_parking) iconName += "_notype";
        else if (tags.bicycle_parking === "lockers") iconName += "_box";
        else if (tags.bicycle_parking.indexOf("stands") !== -1) iconName += "_stand";
        else if (tags.bicycle_parking === "wall_loops" || tags.bicycle_parking === "ground_slots") iconName += "_slot";
        if (tags.covered === "yes") iconName += "_covered";
        
        return "img/" + iconName + ".png";
    },
    
    createShadow: function () {
	return null;
    }
});


L.SpinMapMixin = {
    spin: function (state, options) {
        if (!!state) {
            // start spinning !
            if (!this._spinner) {
                this._spinner = new Spinner(options).spin(this._container);
                this._spinning = 0;
            }
            this._spinning++;
        }
        else {
            this._spinning--;
            if (this._spinning <= 0) {
                // end spinning !
                if (this._spinner) {
                    this._spinner.stop();
                    this._spinner = null;
                }
            }
        }
    }
};

L.Map.include(L.SpinMapMixin);

L.Map.addInitHook(function () {
    this.on('layeradd', function (e) {
        // If added layer is currently loading, spin !
        if (e.layer.loading) this.spin(true);
        if (typeof e.layer.on != 'function') return;
        e.layer.on('data:loading', function () { this.spin(true); }, this);
        e.layer.on('data:loaded',  function () { this.spin(false); }, this);
    }, this);
    this.on('layerremove', function (e) {
        // Clean-up
        if (e.layer.loading) this.spin(false);
        if (typeof e.layer.on != 'function') return;
        e.layer.off('data:loaded');
        e.layer.off('data:loading');
    }, this);
});
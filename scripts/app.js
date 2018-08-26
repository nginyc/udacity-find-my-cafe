function onGoogleMapsApiLoaded() {
    viewModel.init();
}

const viewModel = {
    cafes: [],
    userLocation: ko.observable(null),
    filteredCafes: ko.observableArray([]),
    searchDistanceMeters: ko.observable('2000'),
    cafeSelected: ko.observable(null),
    cafeSelectedDetails: ko.observable(null),
    isMenuOpen: ko.observable(false),
    searchFilterString: ko.observable(''),
    searchAddressString: ko.observable('1 Market Street, San Francisco, CA, USA'),
    isLoading: ko.observable(false),

    init: function() {
        view.init(
            this.userLocation,
            this.filteredCafes,
            this.cafeSelected,
            this.cafeSelectedDetails,
            this.isMenuOpen,
            this.searchAddressString,
            this.searchDistanceMeters,
            this.searchFilterString,
            this.isLoading,
            (cafe) => this._onCafeSelected(cafe),
            () => this._onMenuOpenToggle(),
            () => this._onSubmitSearch(),
            () => this._updateFilteredCafes(),
        );
        googleApi.init();
        foursquareApi.init();
        
        this._onSubmitSearch();
    },

    _onMenuOpenToggle: function() {
        this.isMenuOpen(!this.isMenuOpen());
    },

    _onCafeSelected: function(cafe) {
        this.cafeSelected(cafe);
        this.isMenuOpen(false);

        foursquareApi.pullPlaceDetails(cafe.lat, cafe.lng, cafe.name)
            .then((details) => {
                this.cafeSelectedDetails(details);
            });
    },

    _updateFilteredCafes: function() {
        const searchFilterString = this.searchFilterString();
        const filteredCafes = this.cafes.filter((cafe) => {
            return cafe.name.toLowerCase().includes(searchFilterString.toLowerCase());
        });

        this.filteredCafes(filteredCafes);

        if (filteredCafes.length == 0) {
            view.showAlert('No matching cafes!');
        } else {
            this._onCafeSelected(filteredCafes[0]);
        }
    },

    _onSubmitSearch: function() {
        const addressString = this.searchAddressString();
        if (addressString.trim()) {
            this.isLoading(true);
            googleApi.pullLocationFromAddress(addressString)
                .then((location) => {
                    this.isLoading(false);
                    if (!location) {
                        view.showAlert('Unable to find location from address.');
                    } else {
                        this.userLocation(location);
                        this._reloadCafes();
                    }
                });
        } else {
            this.isLoading(true);
            this._pullUserLocation()
                .then((userLocation) => {
                    this.isLoading(false);
                    this.userLocation(userLocation);
                    this._reloadCafes();
                });
        }
    },

    _reloadCafes: function() {
        const userLocation = this.userLocation();
        const searchDistance = this.searchDistanceMeters();
        this.isLoading(true);
        googleApi.pullPlacesNearLocation(
            userLocation.lat,
            userLocation.lng,
            searchDistance,
            'cafe'
        ).then((cafes) => {
            this.isLoading(false);
            if (cafes.length == 0) {
                view.showAlert('Unable to find any cafes.');
            } else {
                this.cafes = cafes;
                this._updateFilteredCafes();
            }
        });
    },

    _pullUserLocation: function() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported.'));
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }
};

const foursquareApi = {
    CLIENT_ID: 'EZHVEROFCZWGYGKDZBMUUZSRQOKB3ALLT0MUXDQ2E5TA3IJQ',
    CLIENT_SECRET: 'ZQM40VYDJPUXX02ICPEH2FJIPNPNKBNHUV0S4RXHQBLZL1HD',
    
    init: function() {},

    pullPlaceDetails: function(lat, lng, name) {
        return this._fetch('/v2/venues/search', {
            limit: 1,
            query: name,
            ll: lat + ',' + lng
        }).then((res) => {
            return res.json();
        }).then((res) => {
            if (res.response.venues.length == 0) {
                throw new Error('Failed to find venue on Foursquare');
            }
            const venueId = res.response.venues[0].id;
            return this._fetch('/v2/venues/' + venueId, {});
        }).then((res) => {
            return res.json();
        }).then((res) => {
            const details = {};
            if (!res.response.venue) {
                throw new Error('Failed to retrieve venue details on Foursquare');
            }

            if (res.response.venue.hours) {
                details.hoursText = res.response.venue.hours.status;
            }
            details.foursquareUrl = res.response.venue.canonicalUrl;
            details.placeUrl = res.response.venue.url || null; 
            return details;
        });
    },

    _fetch: function(path, options) {
        let url = 'https://api.foursquare.com' + path + 
            '?v=20180323&client_id=' + this.CLIENT_ID + 
            '&client_secret=' + this.CLIENT_SECRET;
        
        for (const option of Object.keys(options)) {
            url += '&' + option + '=' + options[option];
        }

        return fetch(url);
    }
}


const googleApi = {
    init: function() {
        this._placesService = new google.maps.places.PlacesService(view.map);
        this._geocoder = new google.maps.Geocoder();
    },
    
    pullLocationFromAddress: function(addressString) {
        return new Promise((resolve, reject) => {
            this._geocoder.geocode(
                {
                    address: addressString
                },
                (results, status) => {
                    if (status != google.maps.GeocoderStatus.OK &&
                        status != google.maps.GeocoderStatus.ZERO_RESULTS) {
                        console.error(results);
                        reject(new Error(
                            'Error when using Google Geocoding Service: ' + status + '.'
                        ));
                        return;
                    }

                    if (results.length == 0) {
                        resolve(null);
                        return;
                    }
                    
                    const result = results[0];
                    const location = {
                        lat: result.geometry.location.lat(),
                        lng: result.geometry.location.lng()
                    };
                    resolve(location);
                }
            );
        })
    },

    pullPlacesNearLocation: function(lat, lng, radius, type) {
        return new Promise((resolve, reject) => {
            const cafes = [];

            this._placesService.nearbySearch(
                {
                    location: {
                        lat: lat,
                        lng: lng
                    },
                    radius: radius,
                    type: [type]
                },
                (results, status, pagination) => {
                    if (status != google.maps.places.PlacesServiceStatus.OK &&
                        status != google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                        console.error(results);
                        reject(new Error(
                            'Error when using Google Places Service nearby search: ' + status + '.'
                        ));
                        return;
                    }

                    for (const result of results) {
                        cafes.push({
                            id: result.id,
                            placeId: result.place_id,
                            name: result.name,
                            vicinity: result.vicinity,
                            photoUrl: result.photos ? 
                                result.photos[0].getUrl({ 
                                    maxWidth: 360
                                }) : null,
                            lat: result.geometry.location.lat(),
                            lng: result.geometry.location.lng()
                        });
                    }
                    
                    if (!pagination.hasNextPage) {
                        resolve(cafes);
                    } else {
                        pagination.nextPage();
                    }
                }
           );
        });
    }
}

const view = {
    DEFAULT_MAP_CENTER: { 
        lat: 37.7576793, 
        lng: -122.5076404
    }, // San Francisco

    map: null,

    init: function(userLocation, filteredCafes, cafeSelected, cafeSelectedDetails,
        isMenuOpen, searchAddressString, searchDistanceMeters, 
        searchFilterString, isLoading,
        onCafeSelected, onMenuOpenToggle, onSubmitSearch,
        onSubmitFilter) {
        userLocation.subscribe(() => this._setUserLocation(userLocation()));
        filteredCafes.subscribe(() => this._setCafes(filteredCafes()));
        cafeSelected.subscribe(() => this._setCafeSelected(cafeSelected()));
        cafeSelectedDetails.subscribe(() => this._setCafeSelectedDetails(cafeSelected(), cafeSelectedDetails()));

        ko.applyBindings({
            placeSelected: cafeSelected,
            places: filteredCafes,
            isMenuOpen: isMenuOpen,
            searchDistanceMeters: searchDistanceMeters,
            isLoading: isLoading,
            searchFilterString: searchFilterString,
            onMenuOpenToggle: onMenuOpenToggle,
            searchAddressString: searchAddressString,
            onSubmitSearch: onSubmitSearch,
            onSubmitFilter: onSubmitFilter,
            onPlaceSelected: onCafeSelected
        });

        this._onCafeSelected = onCafeSelected;

        this.map = this._makeMap();
    },

    showAlert: function(message) {
        window.alert(message);
    },

    _setUserLocation: function(userLocation) {
       if (this._userLocationMarker) {
            this._userLocationMarker.setMap(null);
       }

       this._userLocationMarker = this._makeUserLocationMarker(
           userLocation.lat, 
           userLocation.lng
        );

        this.map.setZoom(16);
        this.map.setCenter({
            lat: userLocation.lat,
            lng: userLocation.lng
        });
    },

    _setCafes: function(cafes) {
        if (this._cafeMarkers) {
            for (const marker of this._cafeMarkers) {
                marker.setMap(null);
            }
        }

        if (cafes.length == 0) {
            return;
        }

        this._cafeMarkers = cafes.map((cafe) => {
            const marker = this._makeCafeMarker(
                cafe.lat,
                cafe.lng,
                cafe.name
            );
            marker.cafe = cafe; // To get cafe by marker later
            return marker; 
        });

        // Add click listeners to cafe markers
        for (const marker of this._cafeMarkers) {
            marker.addListener('click', () => {
                this._onCafeSelected(marker.cafe);
            });
        }

        // Ensure that markers are all visible
        const bounds = new google.maps.LatLngBounds();
        for (const cafe of cafes) {
            bounds.extend({
                lat: cafe.lat,
                lng: cafe.lng
            });
        }
        this.map.fitBounds(bounds);
    },

    _setCafeSelected: function(cafeSelected) {
        if (!this._cafeMarkers) {
           return;
        }

        const marker = this._cafeMarkers.find((marker) => {
            return marker.cafe.id == cafeSelected.id;
        });

        if (!marker) {
            return;
        }

        // Close previous info window
        if (this._selectedCafeInfoWindow) {
            this._selectedCafeInfoWindow.close();
        }

        // Open a info window for selected cafe
        this._highlightMarker(marker);
        const cafe = cafeSelected;
        this._selectedCafeInfoWindow = this._makeCafeInfoWindow(
            cafe.placeId,
            cafe.name,
            cafe.vicinity,
            cafe.photoUrl
        );
        this._selectedCafeInfoWindow.open(this.map, marker);
    },

    _setCafeSelectedDetails: function(cafeSelected, details) {
        if (!this._selectedCafeInfoWindow) {
            return;
        }

        const cafe = cafeSelected;
        const content = this._getCafeInfoWindowContent(
            cafe.placeId, 
            cafe.name, 
            cafe.vicinity, 
            cafe.photoUrl,
            details.hoursText,
            details.foursquareUrl,
            details.placeUrl
        );

        this._selectedCafeInfoWindow.setContent(content);
    },

    _highlightMarker: function(marker) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => {
            marker.setAnimation(null);
        }, 1000);
    },

    _makeCafeInfoWindow: function(placeId, name, vicinity, photoUrl) {
        const content = this._getCafeInfoWindowContent(placeId, name, vicinity, photoUrl);
        const infoWindow = new google.maps.InfoWindow({
            content: content,
            maxWidth: 400
        });
        return infoWindow;
    },

    _getCafeInfoWindowContent: function(placeId, name, vicinity, 
        photoUrl, hoursText, foursquareUrl, placeUrl) {
        const html = `
            <div class="info_window_box">
                <h2>${name}</h2>
                <p>${vicinity} (<a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${vicinity}&query_place_id=${placeId}">On Google Maps</a>)</p>
                ${photoUrl ? `<img class="image" src="${photoUrl}" />` : ''}
                ${hoursText ? `<p>${hoursText}</p>`: ''}
                <p>
                ${placeUrl ? `<a target="_blank" href="${placeUrl}">Official Site</a>`: ''}
                ${placeUrl && foursquareUrl ? ' | ' : ''}
                ${foursquareUrl ? `<a target="_blank" href="${foursquareUrl}">Foursquare</a>`: ''}
                </p>
            </div>
        `;
        return html;
    },

    _makeUserLocationMarker: function(lat, lng) {
        const marker = new google.maps.Marker({
            icon: {
                url: './images/user_location_marker.png',
            },
            map: this.map,
            position: {
                lat: lat,
                lng: lng
            }
        });

        return marker;
    },

    _makeCafeMarker: function(lat, lng, name) {
        const marker = new google.maps.Marker({
            map: this.map,
            title: name,
            animation: google.maps.Animation.DROP,
            position: {
                lat: lat,
                lng: lng
            }
        });

        return marker;
    },

    _makeMap: function() {
        return new google.maps.Map(
            document.getElementById('map'),
            {
                zoom: 12,
                center: this.DEFAULT_MAP_CENTER
            }
        );
    }
}
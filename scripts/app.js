function onGoogleMapsApiLoaded() {
    viewModel.init();
}

const viewModel = {
    cafes: [],
    userLocation: ko.observable(null),
    filteredCafes: ko.observableArray([]),
    searchDistanceMeters: ko.observable('2000'),
    cafeSelectedId: ko.observable(null),
    isMenuOpen: ko.observable(true),
    searchFilterString: ko.observable(''),
    searchAddressString: ko.observable(''),
    isLoading: ko.observable(false),

    init: function() {
        view.init(
            this.userLocation,
            this.filteredCafes,
            this.cafeSelectedId,
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
        
        this._onSubmitSearch();
    },

    _onMenuOpenToggle: function() {
        this.isMenuOpen(!this.isMenuOpen());
    },

    _onCafeSelected: function(cafe) {
        this.cafeSelectedId(cafe.id);
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
            this.cafeSelectedId(filteredCafes[0].id);
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
        lat: 1.3466341, 
        lng: 103.805542 
    }, // Center of Singapore

    map: null,

    init: function(userLocation, filteredCafes, cafeSelectedId,
        isMenuOpen, searchAddressString, searchDistanceMeters, 
        searchFilterString, isLoading,
        onCafeSelected, onMenuOpenToggle, onSubmitSearch,
        onSubmitFilter) {
        userLocation.subscribe(() => this._setUserLocation(userLocation()));
        filteredCafes.subscribe(() => this._setCafes(filteredCafes()));
        cafeSelectedId.subscribe(() => this._setCafeSelected(cafeSelectedId()));

        ko.applyBindings({
            placeSelectedId: cafeSelectedId,
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

    _setCafeSelected(cafeSelectedId) {
        if (!this._cafeMarkers) {
           return;
        }

        const marker = this._cafeMarkers.find((marker) => {
            return marker.cafe.id == cafeSelectedId
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
        const cafe = marker.cafe;
        this._selectedCafeInfoWindow = this._makeCafeInfoWindow(
            cafe.placeId,
            cafe.name,
            cafe.vicinity,
            cafe.photoUrl
        );
        this._selectedCafeInfoWindow.open(this.map, marker);
    },

    _highlightMarker(marker) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => {
            marker.setAnimation(null);
        }, 1000);
    },

    _makeCafeInfoWindow: function(placeId, name, vicinity, photoUrl) {
        const html = `
            <div class="info_window_box">
                <h2>${name}</h2>
                <p>${vicinity} (<a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${vicinity}&query_place_id=${placeId}">On Google Maps</a>)</p>
                ${photoUrl ? `<img class="image" src="${photoUrl}" />` : ''}
               
            </div>
        `;
        const infoWindow = new google.maps.InfoWindow({
            content: html,
            maxWidth: 400
        });
        return infoWindow;
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
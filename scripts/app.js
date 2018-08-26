function onGoogleMapsApiLoaded() {
    viewModel.init();
}

const viewModel = {
    userLocation: ko.observable(null),
    mapCenter: ko.observable(null),
    cafes: ko.observableArray([]),
    cafeSelectedId: ko.observable(null),
    isMenuOpen: ko.observable(true),
    searchAddressString: ko.observable(null),

    init: function() {
        view.init(
            this.userLocation,
            this.mapCenter,
            this.cafes,
            this.cafeSelectedId,
            this.isMenuOpen,
            this.searchAddressString,
            (cafe) => this._onCafeSelected(cafe),
            () => this._onMenuOpenToggle(),
            () => this._onSearchAddress(),
        );

        this._placesService = new google.maps.places.PlacesService(view.map);
        this._geocoder = new google.maps.Geocoder();

        this.userLocation.subscribe(() => this._onUserLocationUpdated());
        
        this._pullUserLocation()
            .then((userLocation) => {
                this.userLocation(userLocation);
            });
    },

    _onMenuOpenToggle: function() {
        this.isMenuOpen(!this.isMenuOpen());
    },

    _onCafeSelected: function(cafe) {
        this.cafeSelectedId(cafe.id);
    },

    _onSearchAddress: function() {
        const addressString = this.searchAddressString();
        this._pullLocationFromAddress(addressString)
            .then((location) => {
                if (!location) {
                    view.showAlert('Unable to find location from address.');
                } else {
                    this.userLocation(location);
                }
            });
    },

    _onUserLocationUpdated: function() {
        // Center map onto user's location if map center is not yet previously set
        if (this.userLocation() &&
            !this.mapCenter()) {
            this.mapCenter(this.userLocation());
        }

        this._reloadCafes();
    },

    _reloadCafes: function() {
        const userLocation = this.userLocation();
        this._pullPlacesNearLocation(
            userLocation.lat,
            userLocation.lng,
            1000, // 1 km
            'cafe'
        ).then((cafes) => {
            this.cafes(cafes);
        });
    },

    _pullLocationFromAddress: function(addressString) {
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

                    console.log(results);

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

    _pullPlacesNearLocation: function(lat, lng, radius, type) {
        return new Promise((resolve, reject) => {
           this._placesService.nearbySearch(
                {
                    location: {
                        lat: lat,
                        lng: lng
                    },
                    radius: radius,
                    type: [type]
                },
                (results, status) => {
                    if (status != google.maps.places.PlacesServiceStatus.OK) {
                        console.error(results);
                        reject(new Error(
                            'Error when using Google Places Service nearby search: ' + status + '.'
                        ));
                        return;
                    }

                    const cafes = results.map((result) => {
                        return {
                            id: result.id,
                            place_id: result.place_id,
                            name: result.name,
                            openNow: result.open_now,
                            vicinity: result.vicinity,
                            photoUrl: result.photos ? 
                                result.photos[0].getUrl({ 
                                    maxWidth: 200,
                                    maxHeight: 200 
                                }) : null,
                            lat: result.geometry.location.lat(),
                            lng: result.geometry.location.lng()
                        };
                    });
                    
                    resolve(cafes);
                }
           );
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

const view = {
    DEFAULT_MAP_CENTER: { 
        lat: 1.3466341, 
        lng: 103.805542 
    }, // Center of Singapore

    map: null,

    init: function(userLocation, mapCenter, cafes, cafeSelectedId,
        isMenuOpen, searchAddressString,
        onCafeSelected, onMenuOpenToggle, onSearchAddress) {
        mapCenter.subscribe(() => this._setMapCenter(mapCenter()));
        userLocation.subscribe(() => this._setUserLocation(userLocation()));
        cafes.subscribe(() => this._setCafes(cafes()));
        cafeSelectedId.subscribe(() => this._setCafeSelected(cafeSelectedId()));

        ko.applyBindings({
            placeSelectedId: cafeSelectedId,
            places: cafes,
            isMenuOpen: isMenuOpen,
            onMenuOpenToggle: onMenuOpenToggle,
            searchAddressString: searchAddressString,
            onSearchAddress: onSearchAddress
        });

        this._onCafeSelected = onCafeSelected;

        this.map = this._makeMap();
    },

    showAlert: function(message) {
        window.alert(message);
    },
    
    _setMapCenter: function(mapCenter) {
        this.map.setCenter({
            lat: mapCenter.lat,
            lng: mapCenter.lng
        });
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
    },

    _setCafes: function(cafes) {
        if (this._cafeMarkers) {
            for (const marker of this._cafeMarkers) {
                marker.setMap(null);
            }
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
            cafe.name,
            cafe.vicinity,
            cafe.photoUrl,
            cafe.openNow
        );
        this._selectedCafeInfoWindow.open(this.map, marker);
    },

    _highlightMarker(marker) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => {
            marker.setAnimation(null);
        }, 1000);
    },

    _makeCafeInfoWindow: function(name, vicinity, photoUrl, openNow) {
        const html = `
            <div class="info_window_box">
                <span class="_name">${name}</span>
                <span class="_vicinity">${vicinity}</span>
                ${openNow ? '<span class="_open_now">Open now!</span>' : ''}
                ${photoUrl ? `<img class="_image" src="${photoUrl}" />` : ''}
            </div>
        `;
        const infoWindow = new google.maps.InfoWindow({
            content: html,
            maxWidth: 200
        });
        return infoWindow;
    },

    _makeUserLocationMarker: function(lat, lng) {
        const marker = new google.maps.Marker({
            icon: {
                url: './images/user-location-marker.png',
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
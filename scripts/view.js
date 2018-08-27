const view = {
    // Default map center as San Francisco
    DEFAULT_MAP_CENTER: {
        lat: 37.7576793,
        lng: -122.5076404
    },

    // The Google Maps `map` object, corresponding to the map display
    map: null,

    init: function (viewModel) {
        // Apply Knockout UI bindings
        ko.applyBindings(viewModel);

        // Necessarily subscribe to changes to the observables of the view model
        // This is mainly keep the Google Maps drawing in-sync with the view model 
        viewModel.userLocation.subscribe(() => this._setUserLocation(
            viewModel.userLocation()));
        viewModel.cafes.subscribe(() => this._setCafes(viewModel.cafes()));
        viewModel.cafeSelected.subscribe(() => this._setCafeSelected(
            viewModel.cafeSelected()));
        viewModel.cafeSelectedDetails.subscribe(() => this._setCafeSelectedDetails(
            viewModel.cafeSelected(), viewModel.cafeSelectedDetails()
        ));

        // Store callbacks for use by own methods later
        this._onCafeSelected = viewModel.onCafeSelected;

        // Initialize Google Maps `map` object
        this.map = this._makeMap();
    },

    /**
     * Shows an alert with message to the user
     */
    showAlert: function (message) {
        window.alert(message);
    },

    /**
     * Updates the user's location visually on the map
     */
    _setUserLocation: function (userLocation) {
        // Clears the old marker
        if (this._userLocationMarker) {
            this._userLocationMarker.setMap(null);
        }

        // Adds the marker on the map with the updated location
        this._userLocationMarker = this._makeUserLocationMarker(
            userLocation.lat,
            userLocation.lng
        );

        // Center & zoom to updated location
        this.map.setZoom(16);
        this.map.setCenter({
            lat: userLocation.lat,
            lng: userLocation.lng
        });
    },

    /**
     * Updates the cafes visually on the map
     */
    _setCafes: function (cafes) {
        // Clear all old markers
        if (this._cafeMarkers) {
            for (const marker of this._cafeMarkers) {
                marker.setMap(null);
            }
        }

        if (cafes.length == 0) {
            return;
        }

        // Add markers for each cafe
        this._cafeMarkers = cafes.map((cafe) => {
            const marker = this._makeCafeMarker(
                cafe.lat,
                cafe.lng,
                cafe.name
            );

            // To get this cafe by marker later
            marker.cafe = cafe;

            return marker;
        });

        // Add click listeners to cafe markers
        for (const marker of this._cafeMarkers) {
            marker.addListener('click', () => {
                this._onCafeSelected(marker.cafe);
            });
        }

        // Ensure that markers are all visible on map
        const bounds = new google.maps.LatLngBounds();
        for (const cafe of cafes) {
            bounds.extend({
                lat: cafe.lat,
                lng: cafe.lng
            });
        }
        this.map.fitBounds(bounds);
    },

    /**
     * Updates the selected cafe visually on the map
     */
    _setCafeSelected: function (cafeSelected) {
        if (!this._cafeMarkers) {
            return;
        }

        // Find the marker corresponding to the selected cafe
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
        const cafe = cafeSelected;
        this._selectedCafeInfoWindow = this._makeCafeInfoWindow(
            cafe.placeId,
            cafe.name,
            cafe.vicinity,
            cafe.photoUrl
        );
        this._selectedCafeInfoWindow.open(this.map, marker);

        // Highlight selected cafe marker to user
        this._highlightMarker(marker);
    },

    /**
     * Updates the selected cafe's extra details visually on the map
     */
    _setCafeSelectedDetails: function (cafeSelected, details) {
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

    /**
     * Highlights a marker to the user by making it bounce for a while
     */
    _highlightMarker: function (marker) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => {
            marker.setAnimation(null);
        }, 1000);
    },

    /**
     * Makes a Google Maps info window for a cafe
     */
    _makeCafeInfoWindow: function (placeId, name, vicinity, photoUrl) {
        const content = this._getCafeInfoWindowContent(placeId, name,
            vicinity, photoUrl);

        const infoWindowWidth = window.innerWidth >= 480 ? 400 : 200; 

        const infoWindow = new google.maps.InfoWindow({
            content: content,
            maxWidth: infoWindowWidth
        });
        return infoWindow;
    },

    /**
     * Builds the content property of a Google Maps info window for a cafe
     */
    _getCafeInfoWindowContent: function (placeId, name, vicinity,
        photoUrl, hoursText, foursquareUrl, placeUrl) {
        const html =
            `
            <div class="info_window_box">
                <h2>${name}</h2>
                <p>${vicinity} (<a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${vicinity}&query_place_id=${placeId}">On Google Maps</a>)</p>
                ${photoUrl ? `<img alt="${name}" class="image" src="${photoUrl}" />` : ''}
                ${hoursText ? `<p>${hoursText}</p>` : ''}
                <p>
                ${placeUrl ? `<a target="_blank" href="${placeUrl}">Official Site</a>` : ''}
                ${placeUrl && foursquareUrl ? ' | ' : ''}
                ${foursquareUrl ? `<a target="_blank" href="${foursquareUrl}">Foursquare</a>` : ''}
                </p>
            </div>
        `;
        return html;
    },

    /**
     * Makes a Google Maps marker to denote the user's location
     */
    _makeUserLocationMarker: function (lat, lng) {
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

    /**
     * Makes a Google Maps marker to denote a cafe
     */
    _makeCafeMarker: function (lat, lng, name) {
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

    /**
     * Creates the Google Maps `map` object
     */
    _makeMap: function () {
        return new google.maps.Map(
            document.getElementById('map'), {
                zoom: 12,
                center: this.DEFAULT_MAP_CENTER
            }
        );
    }
}
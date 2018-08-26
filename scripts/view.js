const view = {
    DEFAULT_MAP_CENTER: {
        lat: 37.7576793,
        lng: -122.5076404
    }, // San Francisco

    map: null,

    init: function (viewModel) {
        viewModel.userLocation.subscribe(() => this._setUserLocation(viewModel.userLocation()));
        viewModel.cafes.subscribe(() => this._setCafes(viewModel.cafes()));
        viewModel.cafeSelected.subscribe(() => this._setCafeSelected(viewModel.cafeSelected()));
        viewModel.cafeSelectedDetails.subscribe(() => this._setCafeSelectedDetails(viewModel.cafeSelected(), viewModel.cafeSelectedDetails()));
        ko.applyBindings(viewModel);
        this._onCafeSelected = viewModel.onCafeSelected;
        this.map = this._makeMap();
    },

    showAlert: function (message) {
        window.alert(message);
    },

    _setUserLocation: function (userLocation) {
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

    _setCafes: function (cafes) {
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

    _setCafeSelected: function (cafeSelected) {
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

    _highlightMarker: function (marker) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => {
            marker.setAnimation(null);
        }, 1000);
    },

    _makeCafeInfoWindow: function (placeId, name, vicinity, photoUrl) {
        const content = this._getCafeInfoWindowContent(placeId, name, vicinity, photoUrl);
        const infoWindow = new google.maps.InfoWindow({
            content: content,
            maxWidth: 400
        });
        return infoWindow;
    },

    _getCafeInfoWindowContent: function (placeId, name, vicinity,
        photoUrl, hoursText, foursquareUrl, placeUrl) {
        const html = `
            <div class="info_window_box">
                <h2>${name}</h2>
                <p>${vicinity} (<a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${vicinity}&query_place_id=${placeId}">On Google Maps</a>)</p>
                ${photoUrl ? `<img class="image" src="${photoUrl}" />` : ''}
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

    _makeMap: function () {
        return new google.maps.Map(
            document.getElementById('map'),
            {
                zoom: 12,
                center: this.DEFAULT_MAP_CENTER
            }
        );
    }
}
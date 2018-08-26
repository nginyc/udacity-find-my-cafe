const googleApi = {
    init: function () {
        this._placesService = new google.maps.places.PlacesService(view
            .map);
        this._geocoder = new google.maps.Geocoder();
    },

    /**
     * Fetches a location from Google Maps Geocoding API given address string
     * Resolves to the location object of shape { lat, lng }
     */
    pullLocationFromAddress: function (addressString) {
        return new Promise((resolve, reject) => {
            this._geocoder.geocode({
                    address: addressString
                },
                (results, status) => {
                    if (status != google.maps.GeocoderStatus
                        .OK &&
                        status != google.maps.GeocoderStatus
                        .ZERO_RESULTS) {
                        console.error(results);
                        reject(new Error(
                            'Error when using Google Geocoding Service: ' +
                            status + '.'
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

    /**
     * Fetches a list of places from Google Places API given latitude, longitude, radius & place type
     * Resolves to an array of place objects with shape { id, placeId, name, vicinity, photoUrl, lat, lng }
     */
    pullPlacesNearLocation: function (lat, lng, radius, type) {
        return new Promise((resolve, reject) => {
            const places = [];

            this._placesService.nearbySearch({
                    location: {
                        lat: lat,
                        lng: lng
                    },
                    radius: radius,
                    type: [type]
                },
                (results, status, pagination) => {
                    if (status != google.maps.places.PlacesServiceStatus
                        .OK &&
                        status != google.maps.places.PlacesServiceStatus
                        .ZERO_RESULTS) {
                        console.error(results);
                        reject(new Error(
                            'Error when using Google Places Service nearby search: ' +
                            status + '.'
                        ));
                        return;
                    }

                    for (const result of results) {
                        places.push({
                            id: result.id,
                            placeId: result.place_id,
                            name: result.name,
                            vicinity: result.vicinity,
                            photoUrl: result.photos ?
                                result.photos[0].getUrl({
                                    maxWidth: 360
                                }) : null,
                            lat: result.geometry.location
                                .lat(),
                            lng: result.geometry.location
                                .lng()
                        });
                    }

                    // To get more than 1 page of results, keep paging & accumulating
                    // the results until the end
                    if (!pagination.hasNextPage) {
                        resolve(places);
                    } else {
                        pagination.nextPage();
                    }
                }
            );
        });
    }
}
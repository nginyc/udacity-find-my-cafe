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
const foursquareApi = {
    CLIENT_ID: 'EZHVEROFCZWGYGKDZBMUUZSRQOKB3ALLT0MUXDQ2E5TA3IJQ',
    CLIENT_SECRET: 'ZQM40VYDJPUXX02ICPEH2FJIPNPNKBNHUV0S4RXHQBLZL1HD',

    init: function() {},

    /**
     * Fetches a venue's details from Foursquare's API based on latitude, longitude & the venue's name
     * Resolves to a `details` object of shape { hoursText, foursquareUrl, placeUrl }
     */
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

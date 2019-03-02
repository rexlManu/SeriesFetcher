const request = require('request');
const HTMLParser = require('fast-html-parser');
const parse = require('parse-key-value');
const config = require('../config');

module.exports = {
    searchForTitle: function (title) {
        return new Promise((resolve, reject) => {
            request.post({
                url: config.urls.anime4you.searchTitle,
                formData: {
                    search: title
                }
            }, function optionalCallback(err, httpResponse, body) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(body);
            });
        })
    },
    getEpisodes: function (aid) {
        return new Promise((resolve, reject) => {
            request.get({
                url: config.urls.anime4you.episode.replace('%aid%', aid),
            }, function optionalCallback(err, httpResponse, body) {
                if (err) {
                    reject(err);
                    return;
                }
                const episodes = [];
                const content = HTMLParser.parse(body);
                content.querySelector('#episodenliste').childNodes.forEach(value => {
                    if (value.structure && value.childNodes)
                        value.childNodes.forEach(value1 => {
                            if (value1.firstChild)
                                episodes.push(value1.firstChild.text);
                        })
                });
                if (episodes.length === 0) {
                    reject({
                        error: 'no episodes found'
                    });
                    return;
                }
                resolve(episodes);
            });
        });
    },
    getStream: function (aid, episode) {
        return new Promise((resolve, reject) => {
            request.post({
                url: config.urls.anime4you.checkHoster,
                formData: {
                    epi: episode,
                    aid: aid,
                    act: episode,
                    username: '',
                    configcaptcha: 0
                }
            }, function optionalCallback(err, httpResponse, body) {
                if (err) {
                    reject(err);
                    return;
                }
                const content = HTMLParser.parse(body);
                const promises = [];
                const hoster = {};
                content.firstChild.childNodes.forEach(value => {
                    if (value.firstChild) {
                        const hosterList = parse(value.firstChild.rawAttrs
                            .replace(/ /g, ';')
                            .replace(/data-hoster/g, 'datahoster')
                            .replace(/data-src/g, 'datasrc')
                        );
                        switch (hosterList.datahoster) {
                            case 'Rapidvideo':
                            case 'Streamango':
                            case 'Openload':
                                promises.push(getVideoByHash(hosterList.datasrc).then(url => {
                                    hoster[hosterList.datahoster] = url.replace('\t', '');
                                }).catch(reason => {
                                    hoster[hosterList.datahoster] = reason;
                                }));
                                break;
                            case 'Vivo':
                                hoster[hosterList.datahoster] = hosterList.datasrc;
                                break;
                        }
                    }
                });
                Promise.all(promises).then(value => {
                    resolve(hoster);
                })
            });
        });
    },
};

function getVideoByHash(hash) {
    return new Promise((resolve, reject) => {
        request.post({
            url: config.urls.anime4you.checkVideo,
            formData: {
                vidhash: hash
            }
        }, function optionalCallback(err, httpResponse, body) {
            if (err) {
                reject(err);
                return;
            }
            resolve(body);
        });
    })
}
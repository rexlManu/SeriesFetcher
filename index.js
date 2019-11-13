const express = require('express');
const config = require('config.json')('./config.json');
const request = require('request-promise');
const HTMLParser = require('fast-html-parser');
const urls = require('./config').urls;


require('dotenv').config();


const app = express();

const apiRouter = express.Router();

const endpoints = {
    list: {
        trigger: async function (req, res) {
            res.json({
                websites: config.websites,
                endpoints: endpoints
            })
        }
    },
    search: {
        trigger: async function (req, res) {
            const website = config.websites.filter(value => value.name === req.query.website)[0];
            if (!website) {
                res.json({
                    error: "website as parameter required"
                });
                return;
            }
            const title = req.query.title;
            if (!title) {
                res.json({
                    error: "link as parameter required"
                });
                return;
            }
            require('./' + website.module).searchForTitle(title).then(value => {

                var titles = [];
                var promises = [];
                JSON.parse(value).forEach((title) => {
                    promises.push(request({
                        method: "GET",
                        url: urls.anime4you.episode.replace('%aid%', title.value)
                    }).then((response) => {

                        try {

                            var parse = HTMLParser.parse(response);
                            var rawAttrs = parse.querySelector('.dark-bg').childNodes[1].childNodes[1].firstChild.rawAttrs;
                            var imageUrl = rawAttrs.substring(0, rawAttrs.indexOf(' alt')).replace('src="', '').replace('"', '');
                            title.image = urls.anime4you.imageUrl + imageUrl;

                            if (parse.querySelectorAll('.release2')[1].childNodes[1].firstChild.rawText)
                                title.year = parse.querySelectorAll('.release2')[1].childNodes[1].firstChild.rawText;
                            if (parse.querySelectorAll('.stats2')[1].childNodes[1].firstChild.rawText)
                                title.state = parse.querySelectorAll('.stats2')[1].childNodes[1].firstChild.rawText;
                        } catch (e) {

                        }
                        titles.push(title)
                    }).catch(err => console.log(err)));
                });
                Promise.all(promises).then(value1 => {
                    res.json({
                        website: req.query.website,
                        search: title,
                        titles: titles
                    })
                });


            }, reason => {
                res.json({
                    error: reason
                })
            })
        }
    },
    information: {
        trigger: async (req, res) => {
            const website = config.websites.filter(value => value.name === req.query.website)[0];
            if (!website) {
                res.json({
                    error: "website as parameter required"
                });
                return;
            }
            const aid = req.query.aid;
            if (!aid) {
                res.json({
                    error: "aid as parameter required"
                });
                return;
            }
            request({
                method: "GET",
                url: urls.anime4you.episode.replace('%aid%', aid)
            }).then((response) => {

                try {
                    var title = {};
                    var parse = HTMLParser.parse(response);
                    var rawAttrs = parse.querySelector('.dark-bg').childNodes[1].childNodes[1].firstChild.rawAttrs;
                    var imageUrl = rawAttrs.substring(0, rawAttrs.indexOf(' alt')).replace('src="', '').replace('"', '');
                    title.image = urls.anime4you.imageUrl + imageUrl;

                    if (parse.querySelectorAll('.release2')[1].childNodes[1].firstChild.rawText)
                        title.year = parse.querySelectorAll('.release2')[1].childNodes[1].firstChild.rawText;
                    if (parse.querySelectorAll('.stats2')[1].childNodes[1].firstChild.rawText)
                        title.state = parse.querySelectorAll('.stats2')[1].childNodes[1].firstChild.rawText;

                    title.name = parse.querySelector('.titel').childNodes[1].childNodes[0].rawText;

                    switch (parse.querySelector('.titel').childNodes[1].childNodes[1].childNodes[0].childNodes[0].rawText) {
                        case "GerSub&nbsp;":
                            title.type = 'GERSUB';
                            break;
                        case "GerDub&nbsp;":
                            title.type = 'GERDUB';
                            break;
                        default:
                            title.type = 'UNKNOWN';
                            break;
                    }

                    title.description = parse.querySelector('#beschreibung').childNodes[2].childNodes[0].rawText;
                    title.length = parse.querySelectorAll('.laenge2')[1].childNodes[1].childNodes[0].rawText;
                    title.episodes = parse.querySelectorAll('.folgen2')[0].childNodes[1].childNodes[6].childNodes[5].childNodes[1].firstChild.rawText;
                    title.aid = aid;

                    res.json(title);
                } catch (e) {
                    res.json({error: e});
                }
            }).catch(err => console.log(err));
        }
    },
    episodes: {
        trigger: async function (req, res) {
            const website = config.websites.filter(value => value.name === req.query.website)[0];
            if (!website) {
                res.json({
                    error: "website as parameter required"
                });
                return;
            }
            const aid = req.query.aid;
            if (!aid) {
                res.json({
                    error: "aid as parameter required"
                });
                return;
            }

            const streams = typeof req.query.stream != "undefined" && req.query.stream === "true";
            require('./' + website.module).getEpisodes(aid).then(value => {
                const episodes = [];
                const promises = [];
                if (streams) {
                    value.forEach(episodeNumber => {
                        promises.push(request({
                            method: "GET",
                            url: `http://127.0.0.1:${process.env.PORT}/api/v1/stream?website=${website.name}&aid=${aid}&episode=${episodeNumber}`
                        }).then((response) => {
                            episodes.push({
                                episode: episodeNumber,
                                streams: JSON.parse(response).streams
                            })
                        }).catch(err => console.log(err)));
                    })
                }
                Promise.all(promises).then(value1 => {
                    const ordered = [];
                    value.forEach(value2 => {
                        let toPush = {
                            episode: value2,
                        };
                        if (streams) {
                            toPush.streams = episodes.filter(value3 => value3.episode === value2)[0].streams
                        }
                        ordered.push(toPush);
                    });
                    res.json({
                        website: req.query.website,
                        aid: aid,
                        episodes: ordered
                    })
                });
            }, reason => {
                res.json({
                    error: reason
                })
            });
        }
    },
    stream: {
        trigger: async function (req, res) {
            const website = config.websites.filter(value => value.name === req.query.website)[0];
            if (!website) {
                res.json({
                    error: "website as parameter required"
                });
                return;
            }
            const aid = req.query.aid;
            if (!aid) {
                res.json({
                    error: "aid as parameter required"
                });
                return;
            }
            const episode = req.query.episode;
            if (!episode) {
                res.json({
                    error: "episode as parameter required"
                });
                return;
            }
            require('./' + website.module).getStream(aid, episode).then(value => {
                res.json({
                    website: req.query.website,
                    aid: aid,
                    episode: episode,
                    streams: value
                })
            }, reason => {
                res.json({
                    error: reason
                })
            });
        }
    },
};

app.use('/api/v1', apiRouter);

apiRouter.get('/:endpoint', function (req, res) {
    const endpoint = endpoints[req.params.endpoint];
    if (!endpoint) {
        res.json({
            error: 'endpoint not found'
        });
        return;
    }
    endpoint.trigger(req, res);
});

app.listen(process.env.PORT, function () {
    console.log(`SeriesFetcher listening on port ${process.env.PORT}!`);
});

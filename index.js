const express = require('express');
const config = require('config.json')('./config.json');
const request = require('request-promise');
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
                res.json({
                    website: req.query.website,
                    search: title,
                    titles: JSON.parse(value)
                })
            }, reason => {
                res.json({
                    error: reason
                })
            })
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

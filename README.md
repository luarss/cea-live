# CEA-VIZ

Look up any registered Singapore property salesperson and see what the regulator recorded: every residential transaction they handled since January 2017, by property type, deal type, side of the deal, town and month, set against the whole market.

**[cea-viz.onrender.com](https://cea-viz.onrender.com/)**

## Data

The Council for Estate Agencies' [Salespersons' Property Transaction Records (residential)](https://data.gov.sg) on data.gov.sg, about 1.44 million records. Each record has the salesperson, month, property type, transaction type, party represented, and town or district. There are no prices, addresses or ratings. The latest one to two months are incomplete because of reporting lag.

## Running locally

Requires Node 24 (`.nvmrc`).

```sh
make install      # install backend and frontend dependencies
make fetch-data   # download the latest CSV into data/
make build        # build the SQLite database and the frontend
make start        # serve app and API on http://localhost:3003
```

For frontend work, run `make dev` alongside `make start`: Vite serves on port 3000 and calls the API on 3003. Copy `.env.example` to `.env` to set a data.gov.sg API key or CORS origin.

## License

[LICENSE](LICENSE)

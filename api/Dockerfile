FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

COPY prisma ./prisma/ 

RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-maxtimeout 600000 && \
    npm config set maxsockets 5 && \
    npm install --no-audit --no-fund


RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start:prod"]
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 2929
CMD ["node", "server"]
# CMD ["node","index"]
# CMD ["node", "index"]
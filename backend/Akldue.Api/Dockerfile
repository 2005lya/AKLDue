FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Akldue.Api/Akldue.Api.csproj Akldue.Api/
RUN dotnet restore Akldue.Api/Akldue.Api.csproj

COPY . .
WORKDIR /src/Akldue.Api

RUN dotnet publish \
    --configuration Release \
    --output /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Akldue.Api.dll"]
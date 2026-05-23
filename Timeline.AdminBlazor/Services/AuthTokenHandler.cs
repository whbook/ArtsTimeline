using System.Net.Http.Headers;

namespace Timeline.AdminBlazor.Services;

public class AuthTokenHandler : DelegatingHandler
{
    private readonly TokenProvider _tokenProvider;

    public AuthTokenHandler(TokenProvider tokenProvider)
    {
        _tokenProvider = tokenProvider;
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrEmpty(_tokenProvider.Token))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _tokenProvider.Token);

        return base.SendAsync(request, cancellationToken);
    }
}
